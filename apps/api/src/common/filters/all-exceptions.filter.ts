import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let fieldErrors: Record<string, string[]> = {};
    let runId: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = HttpStatus[status] ?? code;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        // Nest may nest our payload under `message` when mixed with statusCode wrappers.
        const nested =
          obj.message &&
          typeof obj.message === 'object' &&
          !Array.isArray(obj.message)
            ? (obj.message as Record<string, unknown>)
            : null;
        const payload = nested ?? obj;
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
          fieldErrors = { _: obj.message.map(String) };
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        } else if (typeof obj.message === 'string') {
          message = obj.message;
        }
        if (typeof payload.code === 'string') {
          code = payload.code;
        } else if (typeof obj.code === 'string') {
          code = obj.code;
        } else {
          code = String(obj.error ?? HttpStatus[status] ?? code);
        }
        if (payload.fieldErrors && typeof payload.fieldErrors === 'object') {
          fieldErrors = payload.fieldErrors as Record<string, string[]>;
        } else if (obj.fieldErrors && typeof obj.fieldErrors === 'object') {
          fieldErrors = obj.fieldErrors as Record<string, string[]>;
        }
        if (typeof payload.runId === 'string' && payload.runId.length > 0) {
          runId = payload.runId;
        } else if (typeof obj.runId === 'string' && obj.runId.length > 0) {
          runId = obj.runId;
        }
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    const exceptionBody =
      exception instanceof HttpException &&
      typeof exception.getResponse() === 'object' &&
      exception.getResponse() !== null
        ? (exception.getResponse() as Record<string, unknown>)
        : null;
    const exceptionPayload =
      exceptionBody &&
      exceptionBody.message &&
      typeof exceptionBody.message === 'object' &&
      !Array.isArray(exceptionBody.message)
        ? (exceptionBody.message as Record<string, unknown>)
        : exceptionBody;

    response.status(status).json({
      error: {
        code,
        message,
        fieldErrors,
        requestId: request.requestId ?? null,
        ...(runId ? { runId } : {}),
        ...(exceptionPayload && Array.isArray(exceptionPayload.reasons)
          ? { reasons: exceptionPayload.reasons }
          : {}),
        ...(exceptionPayload && Array.isArray(exceptionPayload.conflicts)
          ? { conflicts: exceptionPayload.conflicts }
          : {}),
        ...(exceptionPayload &&
        exceptionPayload.suggestedWindow &&
        typeof exceptionPayload.suggestedWindow === 'object'
          ? { suggestedWindow: exceptionPayload.suggestedWindow }
          : {}),
      },
    });
  }
}
