import { redirect } from 'next/navigation';

export default function RootHomePage() {
  // Direct redirect root domain to your primary cafe or landing page
  redirect('/cafegirl-man');
}