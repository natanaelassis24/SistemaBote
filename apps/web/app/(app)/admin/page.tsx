const adminCards = [
  {
    title: "Bots e templates",
    description: "Crie, publique e revise templates de mensagens."
  },
  {
    title: "Planos e limites",
    description: "Defina quotas, numeros e regras de uso."
  },
  {
    title: "Usuarios e permissoes",
    description: "Controle acesso da equipe por perfil."
  },
  {
    title: "Integracoes",
    description: "Gerencie chaves de Twilio, Brevo e Mercado Pago."
  }
];

const tasks = [
  "Revisar template de cobranca (aprovacao Meta pendente).",
  "Atualizar limite do plano Pro para 6 numeros.",
  "Conferir webhooks Mercado Pago para novos planos."
];

export default function Admin() {
  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Controle completo do sistema</h1>
          <p className="lead">
            Aqui ficam os ajustes globais do produto, planos e templates.
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>Escopo</span>
            <strong>Global</strong>
          </div>
          <div className="stat">
            <span>Ambiente</span>
            <strong>Producao</strong>
          </div>
          <div className="stat">
            <span>Ultima publicacao</span>
            <strong>Hoje</strong>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Ferramentas principais</h2>
            <p className="muted">
              Ajustes que afetam todos os tenants.
            </p>
          </div>
          <span className="step-pill">Admin</span>
        </div>
        <div className="grid">
          {adminCards.map((card) => (
            <div className="card" key={card.title}>
              <h3>{card.title}</h3>
              <p className="muted">{card.description}</p>
              <button className="btn small">Abrir</button>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Tarefas pendentes</h2>
            <p className="muted">Prioridades da semana.</p>
          </div>
          <span className="step-pill">Backlog</span>
        </div>
        <div className="card list-card">
          <ul className="list">
            {tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
