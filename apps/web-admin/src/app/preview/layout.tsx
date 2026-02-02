import '../globals.css';

export const metadata = {
  title: 'Preview',
  description: 'Page Preview',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout without dashboard sidebar/header
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
