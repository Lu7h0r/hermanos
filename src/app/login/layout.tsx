export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        nav { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
