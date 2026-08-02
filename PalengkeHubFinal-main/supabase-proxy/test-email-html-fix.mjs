// Verify the deployed worker sends clean emails (no raw HTML dump)
const email = process.argv[2] || 'test-check@example.com';
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
      console.log('\n✅ Email sent via:', data.provider);
      console.log('📧 Verification code:', data.verification_code);
      console.log('No email_html param sent — template {{email_html}} will render empty.');
    } else {
      console.log('\n❌ Worker email endpoint returned an error.');
    }
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
  }
}

main();

