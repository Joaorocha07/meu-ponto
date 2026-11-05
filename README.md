# Meu saldo de horas

Interface para celular, em Next.js, que mostra se o funcionário está devendo horas, a partir do cartão ponto da
Central do Funcionário da Secullum. Só lê dados: não registra nem altera ponto.

A API usada é interna e não oficial (veja `secullum_central_funcionario_api.pdf`). Ela pode mudar sem aviso, e o uso
automatizado pode contrariar os termos da Secullum ou da empresa. Confirme isso antes de divulgar o app.

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha SESSION_SECRET
npm run dev
```

Para testar sem a API real, defina `SECULLUM_BASE_URL=http://localhost:4010` no `.env.local`, rode `npm run mock` em
outro terminal e entre com o usuário `12345678` e a senha `1234`.

Outros comandos: `npm test`, `npm run typecheck`, `npm run build`.

## Como o saldo é calculado

O saldo da API só é confiável depois que o RH processa o dia, então cada dia é classificado em `lib/saldo.ts`:

| Situação do dia | Tratamento | Entra na conta? |
|---|---|---|
| Processado (`situacao = 0`) | Usa o saldo do servidor | Sim |
| Não processado e completo | Marcações menos jornada (estimado) | Sim |
| Folga ou feriado | Saldo zero | Sim |
| Hoje, com marcações faltando | Em andamento | Não |
| Marcações faltando ou em número ímpar | Incompleto | Não, e gera aviso |
| Sem marcações, lançamento desconhecido ou jornada duvidosa | A conferir | Não, e gera aviso |

A regra é não mostrar dívida sem certeza. Por isso, uma falta ainda não processada aparece como aviso, e não como
horas devidas.

O significado de `diaSemana` não foi confirmado (assumimos 0 = domingo). O app compara a jornada com os dias já
processados e, se a maioria divergir, deixa de estimar e marca os dias como "a conferir".

## Segurança

- **Senha:** a API não tem token, então a senha fica em um cookie `httpOnly` criptografado (A256GCM), que expira em 7
  dias. Não há banco de dados.
- **Salvar usuário e senha:** opção desmarcada por padrão. Guarda as credenciais em outro cookie `httpOnly`
  criptografado, por 90 dias, que sobrevive ao logout. A senha nunca volta para o navegador: a página recebe só usuário
  e tipo. Se a senha salva for recusada pela Secullum, ela é apagada, para não arriscar bloquear a conta. Quem usar o
  aparelho consegue entrar, então a opção não serve para aparelhos compartilhados.
- **`SESSION_SECRET`:** quem tiver essa chave e um cookie consegue ler a senha daquela pessoa. Guarde-a como segredo.
- **Dados pessoais:** o cookie guarda só o necessário para consultar (credenciais, primeiro nome, id e jornada). A tela
  "Meu perfil" mostra ao próprio funcionário nome, função, contatos, nascimento, foto e o CPF mascarado. CPF completo,
  RG, filiação, comprovante de endereço, IP de login e geolocalização não saem do servidor. A lista de campos fica em
  `lib/perfil.ts`.
- **Logs:** nunca registre as requisições enviadas à Secullum, porque o header `Authorization` equivale à senha.
- **HTTPS:** obrigatório em produção; o cookie de sessão só trafega nele.
- **Bloqueio de conta:** depois de 5 senhas erradas, o usuário espera 15 minutos. O limite fica em memória, por
  instância do servidor, então é uma proteção parcial em ambientes com várias instâncias.

## Pendências a validar com dados reais

- Mapeamento de `diaSemana` e efeito das tolerâncias de atraso e hora extra.
- Respostas de erro reais (senha errada, conta bloqueada).
- Valores além de `FOLGA` e `Feriado` em `batidas[].valor`, como férias e atestado.
- Se um `identificacaoDispositivo` novo fica visível para o RH.
- O período mostrado é o mês-calendário; o fechamento da empresa pode usar outras datas.
# meu-ponto
