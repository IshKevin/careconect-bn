// Demo accounts shown on the web app's login page while NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS is true.
// They use the reserved domain below, which has no mailbox, so the email service never sends to it.

export const DEMO_EMAIL_DOMAIN = 'demo.isanomed.org';

export const isDemoEmail = (email: string): boolean => email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);

export const DEMO_PASSWORD = 'IsanoDemo#2026';

export const DEMO_ACCOUNTS = {
  admin: { email: `admin@${DEMO_EMAIL_DOMAIN}`, phone: '+250788900001', firstName: 'Demo', lastName: 'Admin' },
  doctor: { email: `doctor@${DEMO_EMAIL_DOMAIN}`, phone: '+250788900002', firstName: 'Aline', lastName: 'Uwase' },
  doctorTwo: { email: `doctor2@${DEMO_EMAIL_DOMAIN}`, phone: '+250788900003', firstName: 'Jean', lastName: 'Mugisha' },
  patient: { email: `patient@${DEMO_EMAIL_DOMAIN}`, phone: '+250788900004', firstName: 'Grace', lastName: 'Mukamana' },
  sponsor: { email: `sponsor@${DEMO_EMAIL_DOMAIN}`, phone: '+250788900005', firstName: 'Eric', lastName: 'Habimana' },
} as const;
