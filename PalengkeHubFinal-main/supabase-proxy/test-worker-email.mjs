// Test the deployed Worker's email endpoint end-to-end
// Usage: node test-worker-email.mjs [you@example.com]

const email = process.argv[2] || 'delivered@resend.dev';
const workerUrl = 'https://supabase-proxy.jhayvy.workers.dev/resend/send-authenticator-email';

async function main() {
  try {
    console.log(`Sending test OTP email to: ${email}`);
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sender_name: 'PalengkeHub' }),
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
    if (res.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ Email delivered via:', data.provider);
      console.log('📧 Verification code:', data.verification_code);
    } else {
      console.log('\n❌ Worker email endpoint returned an error.');
    }
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
  }
}

main();

