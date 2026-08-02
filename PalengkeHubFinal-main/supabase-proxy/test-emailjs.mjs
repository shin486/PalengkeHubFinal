// Test the EmailJS send endpoint directly (mirrors what the Worker does)
// Usage: node test-emailjs.mjs  (optionally: node test-emailjs.mjs you@gmail.com)

const toEmail = process.argv[2] || 'delivered@resend.dev';

const body = {
  service_id: 'service_6hnk087',
  template_id: 'template_cdu562r',
  user_id: 'kGh0qAHDD8McuJl23',
  accessToken: '8ZRFsAbf3X401WgRjof7t',
  template_params: {
    to_email: toEmail,
    from_name: 'PalengkeHub',
    otp_code: '123456',
    expires_minutes: '5',
    subject: 'Your PalengkeHub verification code: 123456',
    message: 'Your PalengkeHub verification code is: 123456',
    email_html: '',
  },
};

async function main() {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text || '(empty)');
    if (res.ok) {
      console.log('\n✅ EmailJS sent successfully!');
    } else {
      console.log('\n❌ EmailJS returned an error.');
    }
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
  }
}

main();

