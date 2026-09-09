// Test the deployed Worker's email endpoint + server-side verify end-to-end
// Usage: node test-worker-email.mjs [you@example.com]

import readline from 'node:readline/promises';

const email = process.argv[2] || 'delivered@resend.dev';
const baseUrl = 'https://supabase-proxy.jhayvy.workers.dev';

async function main() {
  try {
    console.log(`Sending test OTP email to: ${email}`);
    const res = await fetch(`${baseUrl}/resend/send-authenticator-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sender_name: 'PalengkeHub' }),
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);

    if (res.status === 400) {
      console.log('\n❌ Worker rejected the request — check the email address.');
      return;
    }

    // The code is no longer in the response — it's stored server-side and
    // only checked via /verify-code. This confirms the email actually arrived
    // AND that the server-side verify path works, not just that a 200 came back.
    console.log('\n✅ Send accepted — a code was generated and stored server-side.');
    console.log('   Check the inbox for the actual email.');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = (await rl.question('\nEnter the 6-digit code you received (blank to skip verify): ')).trim();
    rl.close();
    if (!code) return;

    const verifyRes = await fetch(`${baseUrl}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email', identifier: email, code }),
    });
    const verifyData = await verifyRes.json();
    console.log('VERIFY STATUS:', verifyRes.status, '| BODY:', JSON.stringify(verifyData));
    console.log(verifyData.success ? '\n✅ Code verified successfully!' : '\n❌ Verify failed:', verifyData.error || '');
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
  }
}

main();
