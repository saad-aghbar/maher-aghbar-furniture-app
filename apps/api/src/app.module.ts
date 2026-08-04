import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CustomersModule } from './modules/customers/customers.module';
import { RequestsModule } from './modules/requests/requests.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module';
import { ProductionModule } from './modules/production/production.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiIntakeModule } from './modules/ai-intake/ai-intake.module';
import { InboundEmailModule } from './modules/inbound-email/inbound-email.module';
import { InboundWhatsAppModule } from './modules/inbound-whatsapp/inbound-whatsapp.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QualityModule } from './modules/quality/quality.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { SupplierInvoicesModule } from './modules/supplier-invoices/supplier-invoices.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrgModule } from './modules/org/org.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { RolesModule } from './modules/roles/roles.module';
import { GeoModule } from './modules/geo/geo.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IntegrationsModule,
    AuthModule,
    HealthModule,
    CustomersModule,
    RequestsModule,
    QuotationsModule,
    SalesOrdersModule,
    ProductionModule,
    TasksModule,
    InventoryModule,
    InvoicesModule,
    PaymentsModule,
    ReportsModule,
    AiIntakeModule,
    InboundEmailModule,
    InboundWhatsAppModule,
    AuditModule,
    NotificationsModule,
    QualityModule,
    DeliveriesModule,
    SuppliersModule,
    DocumentsModule,
    PurchasingModule,
    SupplierInvoicesModule,
    ContractsModule,
    UsersModule,
    CatalogModule,
    OrgModule,
    SettingsModule,
    WarehousesModule,
    RolesModule,
    GeoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
