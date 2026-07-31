import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      requestId?: string;
    }>();
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    const id = req.headers['x-request-id'] ?? uuidv4();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    return next.handle();
  }
}
