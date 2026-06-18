export default function PaymentSuccessPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Payment received ✅</h1>
      <p>
        Thanks — your payment is being confirmed. Your invoice will update once
        Stripe notifies us (the webhook flips it to <code>paid</code>).
      </p>
    </main>
  );
}
