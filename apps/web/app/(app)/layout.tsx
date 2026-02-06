export default function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">SistemaBote</div>
        <nav className="nav-links">
          <a href="/signup">Cadastro</a>
          <a href="/dashboard">Monitoramento</a>
          <a href="/admin">Admin</a>
        </nav>
        <button className="btn small">Entrar</button>
      </header>
      {children}
    </div>
  );
}
