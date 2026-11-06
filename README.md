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
| Não processado, com marcações em número par | Horas trabalhadas menos a jornada do usuário (estimado): negativo se trabalhou menos, positivo se trabalhou mais | Sim |
| Folga ou feriado | Saldo zero | Sim |
| Hoje, com marcações faltando | Em andamento | Não |
| Marcações em número ímpar | Incompleto | Não, e gera aviso |
| Sem marcações, lançamento desconhecido, trabalho em dia sem jornada ou jornada duvidosa | A conferir | Não, e gera aviso |

Um dia sem nenhuma marcação ainda não processado aparece como aviso, e não como horas devidas, porque pode ser falta
ou registro não lançado.

O significado de `diaSemana` não foi confirmado. `alinharJornada` deduz a numeração pela jornada do usuário: se o item
0 tem horas e o item 6 não, a lista começa na segunda; nos outros casos, assume 0 = domingo. O app também compara a
jornada com os dias já processados e, se a maioria divergir, deixa de estimar e marca os dias como "a conferir". A tela
"Meu perfil" mostra a jornada usada para cada dia, o que permite conferir esse mapeamento.

## Compensação de horas

A tela "Compensação" lista os horários do período escolhido e mostra o saldo do período anterior no topo. O botão
"Compensar saldo do mês" registra em que dia do período escolhido aquele saldo foi compensado. O servidor busca o saldo na
Secullum; ele nunca vem do navegador. O registro pode ser desfeito.

Só um saldo com registro entra na conta: positivo abate negativo, meses com o mesmo sinal não se abatem, e o que sobra do
mês anterior não passa adiante. A conta olha no máximo dois meses para trás.

Os registros ficam na tabela `compensacoes` do Postgres (`DATABASE_URL`), por empresa e funcionário, e só valem neste app:
a Secullum e o RH não recebem nada. Sem o banco, a tela continua mostrando as horas e só o registro fica indisponível. O
Painel e o Cartão ponto continuam mostrando o saldo sem compensar.

```sql
create table compensacoes (
  banco text not null,
  funcionario_id integer not null,
  mes_origem text not null check (mes_origem ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data_compensacao date not null,
  minutos integer not null,
  criado_em timestamptz not null default now(),
  primary key (banco, funcionario_id, mes_origem)
);
```

## Recuperação de senha

A tela `/esqueci-senha` segue os 4 passos da API (`RecuperacaoSenha/*`): confere o usuário e mostra o e-mail mascarado,
pede o e-mail completo (a API recusa o mascarado) e envia o código, valida o código e troca a senha. **Os passos reais enviam e-mail e trocam a senha de verdade**, então use o mock para
testar (`npm run mock`, usuário 12345678, e-mail maria@exemplo.com.br, código 123456).

Os formatos de resposta da API são inferidos do front oficial, porque os endpoints nunca foram chamados. Depois da troca,
o app apaga a sessão e a senha salva daquele usuário neste navegador, para não reenviar a senha antiga. Há um limite em
memória, por instância: 3 envios de código e 5 e-mails ou códigos errados a cada 15 minutos.

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
- O período vai do dia 21 ao dia 20 (fechamento da empresa, `DIA_FECHAMENTO` em `lib/periodo.ts`) e leva o nome do mês em que fecha: "novembro" é de 21/10 a 20/11.
# meu-ponto
