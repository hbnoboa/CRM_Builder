export const metadata = {
  title: 'Preview',
  description: 'Page Preview',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background antialiased">
      {children}
    </div>
  );
}
