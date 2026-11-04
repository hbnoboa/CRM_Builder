import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import { OpsMonitorService } from '../services/ops-monitor.service';

/** Erros do Prisma causados pelo pedido (dado invalido, restricao, nao encontrado). */
const CLIENT_PRISMA_CODES = new Set([
  'P2000', 'P2001', 'P2004', 'P2005', 'P2006', 'P2007', 'P2011', 'P2012', 'P2013', 'P2014',
  'P2015', 'P2017', 'P2018', 'P2019', 'P2020',
]);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';
    let errors: string[] | undefined;
    // Codigo de erro de negocio (ex.: PLAN_LIMIT, FEATURE_DISABLED, TENANT_SUSPENDED)
    // para o cliente reagir sem depender do texto da mensagem.
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        if (typeof resp.code === 'string') {
          const { message: _m, statusCode: _s, error: _e, ...rest } = resp;
          details = rest;
        }

        // Validation errors from class-validator
        if (Array.isArray(resp.message)) {
          message = 'Erro de validacao';
          errors = resp.message as string[];
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors without exposing internals
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Registro duplicado';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Registro nao encontrado';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Referencia invalida';
          break;
        case 'P2034':
          // Conflito de escrita/deadlock: o cliente pode tentar de novo.
          status = HttpStatus.CONFLICT;
          message = 'Conflito ao gravar. Tente novamente.';
          break;
        default:
          if (CLIENT_PRISMA_CODES.has(exception.code)) {
            status = HttpStatus.BAD_REQUEST;
            message = 'Erro na operacao do banco de dados';
          } else {
            // Tabela/coluna inexistente, SQL que falhou, banco fora, pool esgotado...:
            // falha do servidor (500, registrada na saude do sistema), nao do pedido.
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Erro interno do servidor';
          }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Dados invalidos';
    }

    // Throttler responde em ingles ("ThrottlerException: Too Many Requests") e isso
    // vai direto para a tela de login.
    if (exception instanceof ThrottlerException) {
      message = 'Muitas tentativas. Aguarde um minuto e tente novamente.';
    }

    // Erros 500: guardados para a tela "Saude do sistema" do console.
    if (status >= 500) {
      OpsMonitorService.current?.recordError({
        status, method: request?.method ?? '', path: request?.url ?? '',
        message: exception instanceof Error ? exception.message : String(message),
      });
    }

    // Log the full error internally
    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const responseBody: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errors) {
      responseBody.errors = errors;
    }
    if (details) {
      Object.assign(responseBody, details);
    }

    // Only include stack trace in development
    if (!isProduction && exception instanceof Error) {
      responseBody.stack = exception.stack;
    }

    response.status(status).json(responseBody);
  }
}
