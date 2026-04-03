import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import CustomerNotesForm from './CustomerNotesForm';

export const dynamic = 'force-dynamic';

const ALLOWED_DOCUMENT_TYPES = new Set(['license', 'insurance']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getExtensionFromFile(file: File) {
  const original = file.name?.trim() || '';
  const extFromName = path.extname(original);

  if (extFromName) {
    return extFromName.toLowerCase();
  }

  switch (file.type) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

function getCustomerVerificationStatus(
  documents: Array<{ documentType: string; status: string }>
) {
  if (documents.length === 0) {
    return 'unverified';
  }

  if (documents.some((document) => document.status === 'rejected')) {
    return 'rejected';
  }

  const hasApprovedLicense = documents.some(
    (document) =>
      document.documentType === 'license' && document.status === 'approved'
  );

  const hasApprovedInsurance = documents.some(
    (document) =>
      document.documentType === 'insurance' && document.status === 'approved'
  );

  if (hasApprovedLicense && hasApprovedInsurance) {
    return 'approved';
  }

  return 'pending';
}

async function syncCustomerVerification(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      manualVerificationStatus: true,
    },
  });

  if (customer?.manualVerificationStatus) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        verificationStatus: customer.manualVerificationStatus,
        verifiedAt:
          customer.manualVerificationStatus === 'approved'
            ? new Date()
            : null,
      },
    });
    return;
  }

  const customerDocuments = await prisma.customerDocument.findMany({
    where: { customerId },
    select: {
      documentType: true,
      status: true,
    },
  });

  const verificationStatus = getCustomerVerificationStatus(customerDocuments);

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      verificationStatus,
      verifiedAt: verificationStatus === 'approved' ? new Date() : null,
    },
  });
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'approved':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
    case 'pending':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300';
    case 'unverified':
      return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function formatDateTime(value: Date | string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function setManualStatus(
  customerId: number,
  status: 'approved' | 'rejected' | 'pending'
) {
  'use server';

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      manualVerificationStatus: status,
      verificationStatus: status,
      verifiedAt: status === 'approved' ? new Date() : null,
    },
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

async function clearManualStatus(customerId: number) {
  'use server';

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      manualVerificationStatus: null,
    },
  });

  await syncCustomerVerification(customerId);

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

async function uploadCustomerDocument(formData: FormData) {
  'use server';

  const customerIdValue = formData.get('customerId');
  const documentTypeValue = formData.get('documentType');
  const notesValue = formData.get('notes');
  const fileValue = formData.get('file');

  const customerId = Number(customerIdValue);
  const documentType = String(documentTypeValue || '').trim().toLowerCase();
  const notes = String(notesValue || '').trim();

  if (!customerIdValue || Number.isNaN(customerId)) {
    throw new Error('Valid customerId is required.');
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    throw new Error('Document type must be license or insurance.');
  }

  if (!(fileValue instanceof File)) {
    throw new Error('A file is required.');
  }

  if (fileValue.size === 0) {
    throw new Error('Uploaded file is empty.');
  }

  if (fileValue.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File exceeds 10 MB limit.');
  }

  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
    throw new Error('Unsupported file type. Use PDF, JPG, PNG, or WEBP.');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new Error('Customer not found.');
  }

  const uploadsDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'customer-documents'
  );

  await mkdir(uploadsDir, { recursive: true });

  const ext = getExtensionFromFile(fileValue);
  const safeOriginalName = sanitizeFilename(fileValue.name || 'document');
  const storedFilename = `${documentType}-${customerId}-${randomUUID()}${ext}`;
  const absoluteFilePath = path.join(uploadsDir, storedFilename);
  const publicFilePath = `/uploads/customer-documents/${storedFilename}`;

  const bytes = await fileValue.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await writeFile(absoluteFilePath, buffer);

  await prisma.customerDocument.create({
    data: {
      customerId,
      documentType,
      filePath: publicFilePath,
      originalName: safeOriginalName,
      mimeType: fileValue.type || null,
      notes: notes || null,
      status: 'pending',
    },
  });

  await syncCustomerVerification(customerId);

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

async function updateDocumentStatus(
  customerId: number,
  documentId: number,
  nextStatus: 'approved' | 'rejected'
) {
  'use server';

  const existingDocument = await prisma.customerDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!existingDocument) {
    throw new Error('Document not found.');
  }

  await prisma.customerDocument.update({
    where: { id: documentId },
    data: {
      status: nextStatus,
      reviewedAt: new Date(),
    },
  });

  await syncCustomerVerification(existingDocument.customerId);

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

async function renameDocument(customerId: number, formData: FormData) {
  'use server';

  const documentId = Number(formData.get('documentId'));
  const originalName = String(formData.get('originalName') || '').trim();

  if (Number.isNaN(documentId)) {
    throw new Error('Invalid document.');
  }

  if (!originalName) {
    throw new Error('Document name is required.');
  }

  const existingDocument = await prisma.customerDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!existingDocument) {
    throw new Error('Document not found.');
  }

  await prisma.customerDocument.update({
    where: { id: documentId },
    data: {
      originalName: sanitizeFilename(originalName),
    },
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

async function deleteDocument(customerId: number, documentId: number) {
  'use server';

  const existingDocument = await prisma.customerDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      customerId: true,
      filePath: true,
    },
  });

  if (!existingDocument) {
    throw new Error('Document not found.');
  }

  if (existingDocument.filePath) {
    const fullPath = path.join(process.cwd(), 'public', existingDocument.filePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      console.warn('Failed to delete file from disk:', error);
    }
  }

  await prisma.customerDocument.delete({
    where: { id: documentId },
  });

  await syncCustomerVerification(existingDocument.customerId);

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${customerId}`);
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    notFound();
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: {
            select: {
              year: true,
              make: true,
              model: true,
              color: true,
              pricePerDay: true,
            },
          },
        },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          documentType: true,
          originalName: true,
          filePath: true,
          status: true,
          notes: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          bookings: true,
          documents: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="text-sm text-gray-500 underline-offset-4 hover:underline"
          >
            ← Back to customers
          </Link>
          <h2 className="mt-2 text-2xl font-semibold">{customer.fullName}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Customer profile, verification documents, and booking history.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-2">
            <span className="font-medium">Bookings:</span> {customer._count.bookings}
          </div>
          <div className="mb-2">
            <span className="font-medium">Documents:</span> {customer._count.documents}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-medium">Verification:</span>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                customer.verificationStatus
              )}`}
            >
              {customer.verificationStatus}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <form action={setManualStatus.bind(null, customer.id, 'approved')}>
              <button
                type="submit"
                className="rounded-xl border border-green-300 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
              >
                Approve
              </button>
            </form>

            <form action={setManualStatus.bind(null, customer.id, 'rejected')}>
              <button
                type="submit"
                className="rounded-xl border border-red-300 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Reject
              </button>
            </form>

            <form action={setManualStatus.bind(null, customer.id, 'pending')}>
              <button
                type="submit"
                className="rounded-xl border border-yellow-300 px-3 py-1 text-xs font-medium text-yellow-700 transition hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/30"
              >
                Needs Review
              </button>
            </form>

            <form action={clearManualStatus.bind(null, customer.id)}>
              <button
                type="submit"
                className="rounded-xl border border-gray-300 px-3 py-1 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                Auto
              </button>
            </form>
          </div>

          {customer.manualVerificationStatus ? (
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Manual override active: {customer.manualVerificationStatus}
            </div>
          ) : (
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Status is currently driven by document approvals.
            </div>
          )}

          <div className="text-gray-500">
            Created {formatDateTime(customer.createdAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-lg font-semibold">Contact Details</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-gray-500">Full Name</div>
              <div className="font-medium">{customer.fullName}</div>
            </div>

            <div>
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{customer.email}</div>
            </div>

            <div>
              <div className="text-gray-500">Phone</div>
              <div className="font-medium">{customer.phone}</div>
            </div>

            {customer.verifiedAt ? (
              <div>
                <div className="text-gray-500">Verified At</div>
                <div className="font-medium">{formatDateTime(customer.verifiedAt)}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 lg:col-span-2">
          <h3 className="text-lg font-semibold">Internal Notes</h3>
          <CustomerNotesForm
            customerId={customer.id}
            initialNotes={customer.notes ?? ''}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold">Upload Document</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Upload a license or insurance file for this customer.
          </p>
        </div>

        <div className="p-5">
          <form action={uploadCustomerDocument} className="grid gap-4 md:grid-cols-4">
            <input type="hidden" name="customerId" value={customer.id} />

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Document Type
              </label>
              <select
                name="documentType"
                defaultValue="license"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="license">License</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                File
              </label>
              <input
                type="file"
                name="file"
                required
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Notes
              </label>
              <input
                type="text"
                name="notes"
                placeholder="Optional notes"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:border-white dark:bg-white dark:text-black"
              >
                Upload Document
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Uploaded Documents</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Review, rename, approve, reject, or delete customer files.
              </p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {customer.documents.length} on file
            </div>
          </div>
        </div>

        <div className="p-5">
          {customer.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {customer.documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {document.documentType.charAt(0).toUpperCase() +
                            document.documentType.slice(1)}
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusClasses(
                            document.status
                          )}`}
                        >
                          {document.status}
                        </span>
                      </div>

                      <form
                        action={renameDocument.bind(null, customer.id)}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      >
                        <input type="hidden" name="documentId" value={document.id} />
                        <input
                          type="text"
                          name="originalName"
                          defaultValue={document.originalName}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 sm:w-80"
                        />
                        <button
                          type="submit"
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                        >
                          Save Name
                        </button>
                      </form>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Uploaded: {formatDateTime(document.createdAt)}
                        {document.reviewedAt
                          ? ` • Reviewed: ${formatDateTime(document.reviewedAt)}`
                          : ''}
                      </div>

                      {document.notes ? (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Notes: {document.notes}
                        </div>
                      ) : null}

                      <Link
                        href={document.filePath}
                        target="_blank"
                        className="inline-flex text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                      >
                        Open file
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form
                        action={updateDocumentStatus.bind(
                          null,
                          customer.id,
                          document.id,
                          'approved'
                        )}
                      >
                        <button
                          type="submit"
                          className="rounded-xl border border-green-300 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
                        >
                          Approve
                        </button>
                      </form>

                      <form
                        action={updateDocumentStatus.bind(
                          null,
                          customer.id,
                          document.id,
                          'rejected'
                        )}
                      >
                        <button
                          type="submit"
                          className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          Reject
                        </button>
                      </form>

                      <form action={deleteDocument.bind(null, customer.id, document.id)}>
                        <button
                          type="submit"
                          className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold">Booking History</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            All bookings associated with this customer.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Booking</th>
                <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                <th className="px-4 py-3 text-left font-medium">Pickup</th>
                <th className="px-4 py-3 text-left font-medium">Return</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {customer.bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No bookings found for this customer.
                  </td>
                </tr>
              ) : (
                customer.bookings.map((booking) => {
                  const vehicleName = booking.vehicle
                    ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}${
                        booking.vehicle.color ? ` (${booking.vehicle.color})` : ''
                      }`
                    : `Vehicle ${booking.vehicleId}`;

                  return (
                    <tr key={booking.id}>
                      <td className="px-4 py-4 font-medium">
                        <Link
                          href={`/admin/bookings?bookingId=${booking.id}`}
                          className="text-blue-600 transition hover:underline dark:text-blue-400"
                        >
                          #{booking.id}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/vehicles?vehicleId=${booking.vehicleId}`}
                          className="text-blue-600 transition hover:underline dark:text-blue-400"
                        >
                          {vehicleName}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        {new Date(booking.pickupAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {new Date(booking.returnAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium capitalize dark:border-gray-700">
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {new Date(booking.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}