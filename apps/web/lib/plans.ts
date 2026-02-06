export const planCatalog = {
  starter: {
    label: "Starter",
    price: "R$ 49",
    billing: "/mes",
    messageLimit: "1.000 mensagens/mes",
    botLimit: 1,
    channels: ["WhatsApp"],
    areas: ["Suporte"],
    features: ["1 bot ativo", "1 numero WhatsApp", "Apenas WhatsApp"]
  },
  pro: {
    label: "Pro",
    price: "R$ 149",
    billing: "/mes",
    messageLimit: "5.000 mensagens/mes",
    botLimit: 3,
    channels: ["WhatsApp", "SMS", "Email"],
    areas: ["Suporte", "Vendas", "Cobranca"],
    features: ["3 bots ativos", "2 numeros WhatsApp", "SMS e Email completos"]
  },
  business: {
    label: "Business",
    price: "R$ 399",
    billing: "/mes",
    messageLimit: "20.000 mensagens/mes",
    botLimit: 10,
    channels: ["WhatsApp", "SMS", "Email"],
    areas: ["Suporte", "Vendas", "Cobranca", "Agendamento", "Pos-venda", "Financeiro"],
    features: ["10 bots ativos", "5 numeros WhatsApp", "Prioridade no suporte"]
  }
} as const;

export const planOrder = ["starter", "pro", "business"] as const;

export type PlanId = keyof typeof planCatalog;
