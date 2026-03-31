"use client";

import { useSearchParams } from "next/navigation";

export default function BookingConfirmation() {
  const params = useSearchParams();

  const bookingId = params.get("bookingId");
  const name = params.get("name");
  const vehicle = params.get("vehicle");
  const pickupAt = params.get("pickupAt");
  const returnAt = params.get("returnAt");

  return (
    <div style={{ padding: "2rem" }}>
      <h1>✅ Booking Confirmed</h1>

      <p><strong>Booking ID:</strong> {bookingId}</p>
      <p><strong>Name:</strong> {name}</p>
      <p><strong>Vehicle:</strong> {vehicle}</p>
      <p><strong>Pickup:</strong> {new Date(pickupAt || "").toLocaleString()}</p>
      <p><strong>Return:</strong> {new Date(returnAt || "").toLocaleString()}</p>
    </div>
  );
}