import { buildCustomerEmailHtml, type CustomerEmailModel } from '@/lib/emailLayout';

export default function CustomerEmail(model: CustomerEmailModel) {
  const html = buildCustomerEmailHtml(model);
  return (
    <iframe
      title="Customer email preview"
      className="nsos-email-frame"
      sandbox=""
      srcDoc={html}
    />
  );
}
