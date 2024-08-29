# Back-end - Gemini API

## Tecnologias Utilizadas

  - `Node.Js`
  - `Prisma`
  - `TypeScript`
  - `Fastify`
  - `Postgresql`
  - `Cors`

## Instalação do Projeto

Para a instalação projeto é necessário ter o Docker e o Git instalado no computador.

Para começar a Instalação, clone o repositório na sua maquina local.

Para clonar o repositório, abra o terminal e execute o seguinte comando:

```bash
  git clone https://github.com/murilo-simoes/backend-gemini-test.git
```

Na pasta raiz do projeto, crie um arquivo .env e coloque sua chave da API do Gemini igual no exemplo abaixo:

```bash
  GEMINI_API_KEY={your_api_key}
```

Após isso, abra o terminal na pasta raiz do projeto e execute o seguinte comando:

```bash
  docker-compose up
```

Depois de terminar a instalação do container, navegue até o Docker e verifique se o container está em execução normalmente.

Após isso, a API já está pronta para usar.

## Endpoints

Os endpoints do projeto podem ser acessados pela URL http://localhost:3000.

### POST - http://localhost:3000/upload

Responsável por receber uma imagem em base 64, consultar o Gemini e retornar a
medida lida pela API

Exemplo de corpo da requisição:
```json
{
  "customer_code": "123456",
  "measure_datetime": "2024-08-27T15:45:00Z",
  "measure_type": "WATER" ou "GAS",
  "image": "base64"
}
```

### PATCH - http://localhost:3000/confirm

Responsável por confirmar ou corrigir o valor lido pelo LLM

Exemplo de corpo da requisição:
```json
{
  "measure_uuid": "b591f5f3-f6a9-4af6-a5ca-35614f27e17d",
  "confirmed_value": 542
}
```

### GET - http://localhost:3000/:customer_code/list?measure_type={"WATER" ou "GAS"}

Responsável por listar as medidas realizadas por um determinado cliente, também sendo possível realizar uma filtragem pelo tipo de medição

Exemplo de PATH PARAMETERS:
  customer_code - "123456"

Exemplo de QUERY PARAMETERS:
  measure_type - "WATER" ou "GAS"

