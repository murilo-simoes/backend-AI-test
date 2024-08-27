import { FastifyReply } from "fastify";


//Função para verificar se uma string existe ou se não está vazia ou nula
export function EmptyOrNull(str: string | null | undefined): boolean {
    return !str || str.trim().length === 0;
}

//Função para retornar o status de erro - BadRequest
export function BadRequest(metodo: FastifyReply, error: string, codeError: string, code: number){
    return metodo.status(code).send({
        error_code:codeError,
        error_description: error
      });
}