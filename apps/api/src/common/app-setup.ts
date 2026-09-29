import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // drop unknown fields
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true, // "2" -> 2, apply defaults
    }),
  );
  app.enableShutdownHooks();
}
