import { Asset, Application, ApplicationSegment, ApplicationStatus, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from './types';
import { GEANZ_CATEGORY_ID } from './lib/geanzCatalogue';

/**
 * Returns a date string (YYYY-MM-DD) relative to the current calendar year.
 * yearOffset=0 → current year, yearOffset=1 → next year, etc.
 */
function relDate(yearOffset: number, month: number, day: number): string {
    const year = new Date().getFullYear() + yearOffset;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const demoTimelineSettings: TimelineSettings = {
    startDate: relDate(0, 1, 1),
    monthsToShow: 36,
    budgetVisualisation: 'off',
    descriptionDisplay: 'off',
    emptyRowDisplay: 'show',
    snapToPeriod: 'off',
    conflictDetection: 'on',
    showRelationships: 'on',
    collapsedGroups: [],
    sidebarWidth: 256,
};

export const demoAssetCategories: AssetCategory[] = [
    { id: 'cat-iam', name: 'Identity & Access Management', order: 1 },
    { id: 'cat-data', name: 'Data Platform', order: 2 },
    { id: 'cat-channel', name: 'Customer Channels', order: 3 },
    { id: 'cat-core', name: 'Core Banking', order: 4 },
    { id: 'cat-cloud', name: 'Cloud Infrastructure', order: 5 },
    { id: 'cat-int', name: 'Integration & APIs', order: 6 },
];

export const demoStrategies: Strategy[] = [
    { id: 'strat-cloud', name: 'Cloud First', color: 'bg-sky-500' },
    { id: 'strat-cust', name: 'Customer First', color: 'bg-indigo-500' },
    { id: 'strat-zero', name: 'Zero Trust', color: 'bg-rose-500' },
    { id: 'strat-api', name: 'API-Led Architecture', color: 'bg-emerald-500' },
    { id: 'strat-data', name: 'Data-Driven Decisions', color: 'bg-amber-500' },
    { id: 'strat-reg', name: 'Regulatory Compliance', color: 'bg-orange-500' },
];

export const demoProgrammes: Programme[] = [
    { id: 'prog-dtp', name: 'Digital Transformation', color: 'bg-blue-500' },
    { id: 'prog-reg', name: 'Regulatory Programme', color: 'bg-amber-500' },
    { id: 'prog-cloud', name: 'Cloud Migration', color: 'bg-sky-500' },
    { id: 'prog-cx', name: 'Customer Experience', color: 'bg-fuchsia-500' },
    { id: 'prog-mod', name: 'Tech Modernisation', color: 'bg-rose-500' },
    { id: 'prog-data', name: 'Data & Analytics', color: 'bg-emerald-500' },
];

export const demoAssets: Asset[] = [
    // Identity & Access Management
    { id: 'a-ciam', name: 'Customer IAM (CIAM)', categoryId: 'cat-iam', maturity: 5 },
    { id: 'a-eiam', name: 'Employee IAM', categoryId: 'cat-iam', maturity: 3 },
    { id: 'a-pam', name: 'Privileged Access Mgmt', categoryId: 'cat-iam', maturity: 1 },
    // Data Platform
    { id: 'a-lake', name: 'Enterprise Data Lake', categoryId: 'cat-data', maturity: 3 },
    { id: 'a-dwh', name: 'Data Warehouse', categoryId: 'cat-data', maturity: 4 },
    { id: 'a-mdm', name: 'Master Data Mgmt', categoryId: 'cat-data' },
    // Customer Channels
    { id: 'a-web', name: 'Internet Banking', categoryId: 'cat-channel', maturity: 4 },
    { id: 'a-mobile', name: 'Mobile Banking App', categoryId: 'cat-channel', maturity: 3 },
    { id: 'a-cc', name: 'Contact Centre Platform', categoryId: 'cat-channel', maturity: 2 },
    // Core Banking
    { id: 'a-core', name: 'Core Ledger', categoryId: 'cat-core', maturity: 2 },
    { id: 'a-pay', name: 'Payments Engine', categoryId: 'cat-core', maturity: 3 },
    { id: 'a-lend', name: 'Lending Platform', categoryId: 'cat-core', maturity: 2 },
    // Cloud Infrastructure
    { id: 'a-k8s', name: 'Kubernetes Platform', categoryId: 'cat-cloud', maturity: 4 },
    { id: 'a-obs', name: 'Observability Stack', categoryId: 'cat-cloud', maturity: 3 },
    // Integration & APIs
    { id: 'a-apigw', name: 'API Gateway', categoryId: 'cat-int', maturity: 4 },
    { id: 'a-esb', name: 'Enterprise Service Bus', categoryId: 'cat-int', maturity: 1 },

    // ── GEANZ Application Technology ──────────────────────────────────────────
    // TAP.01 Corporate application area
    { id: 'gz-fmis',    name: 'Financial Management Information System (FMIS) applications', categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.01.01', externalId: 'CSVB294C767' },
    { id: 'gz-hrm',     name: 'Human Resource Management applications',                       categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.01.02', externalId: 'CSV9CDA5FCC' },
    { id: 'gz-erp',     name: 'Enterprise Resource Planning (ERP)',                           categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.01.15', externalId: 'CSV5C9C46F0' },
    // TAP.02 Service Delivery application area
    { id: 'gz-case',    name: 'Case Management applications',                                 categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.02.03', externalId: 'CSVCB72B91D' },
    { id: 'gz-crm',     name: 'Customer Relationship Management (CRM) applications',          categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.02.12', externalId: 'CSV659E16F7' },
    // TAP.03 Experience and Interactions application area
    { id: 'gz-portal',  name: 'Customer Portal Application Service',                          categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.03.05', externalId: 'CSV4EDA4D6B' },
    { id: 'gz-wcm',     name: 'Web Content Management applications',                          categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.03.09', externalId: 'CSV2696D177' },
    // TAP.04 Data and Information Management application area
    { id: 'gz-datagov', name: 'Data Governance applications',                                 categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.04.02', externalId: 'CSV0AC940D8' },
    { id: 'gz-records', name: 'Records Management applications',                              categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.04.05', externalId: 'CSVC7AAA098' },
    // TAP.06 Integration application area
    { id: 'gz-apimgmt', name: 'API Management',                                               categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.06.01', externalId: 'CSVB339C355' },
    { id: 'gz-gesb',    name: 'Enterprise Service Bus (ESB)',                                 categoryId: GEANZ_CATEGORY_ID, maturity: 1, alias: 'TAP.06.07', externalId: 'CSVE50DEFAC' },
    // TAP.07 Identity and Access Management application area
    { id: 'gz-idgov',   name: 'Identity Governance and Accountability',                       categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.07.01', externalId: 'CSV9DB5866D' },
    { id: 'gz-authn',   name: 'Authentication',                                               categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.07.03', externalId: 'CSVC5CFCFD9' },
    // TAP.08 Security application area
    { id: 'gz-netsec',  name: 'Network Security',                                             categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.08.02', externalId: 'CSV3AB53698' },
    { id: 'gz-siem',    name: 'Security Incident and Event Management',                       categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.08.11', externalId: 'CSV40193523' },
    // TAP.09 Orchestration and Workflow application area
    { id: 'gz-bpm',     name: 'Business Process Management applications',                     categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.09.01', externalId: 'CSVFEB38CD6' },
    // TAP.12 ICT Management application area
    { id: 'gz-itsm',    name: 'ICT Service Management (ITSM)',                                categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.12.01', externalId: 'CSV027352E4' },
    { id: 'gz-cmdb',    name: 'ICT Configuration Management Database (CMDB)',                 categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.12.02', externalId: 'CSV17DC6C4F' },
    // TAP.13 Collaboration application area
    { id: 'gz-email',   name: 'Email applications',                                           categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.13.01', externalId: 'CSV13_01' },
    { id: 'gz-video',   name: 'Video Services applications',                                  categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.13.04', externalId: 'CSV13_04' },
    // TAP.14 Monitoring and Reporting application area
    { id: 'gz-sysmon',  name: 'System Monitoring applications',                               categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.14.01', externalId: 'CSV14_01' },
    { id: 'gz-apm',     name: 'Application Performance Monitoring applications',              categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.14.02', externalId: 'CSV14_02' },
    // TAP.15 Infrastructure and Cloud application area
    { id: 'gz-iaas',    name: 'Infrastructure as a Service (IaaS)',                           categoryId: GEANZ_CATEGORY_ID, maturity: 4, alias: 'TAP.15.01', externalId: 'CSV15_01' },
    { id: 'gz-paas',    name: 'Platform as a Service (PaaS)',                                 categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.15.02', externalId: 'CSV15_02' },
    // TAP.16 Analytics and Business Intelligence (BI) application area
    { id: 'gz-dwh',     name: 'Data Warehouse applications',                                  categoryId: GEANZ_CATEGORY_ID, maturity: 3, alias: 'TAP.16.01', externalId: 'CSV16_01' },
    { id: 'gz-bi',      name: 'Business Intelligence Reporting applications',                 categoryId: GEANZ_CATEGORY_ID, maturity: 2, alias: 'TAP.16.02', externalId: 'CSV16_02' },
];

export const demoApplications: Application[] = [
    // Customer IAM (CIAM) — a-ciam
    { id: 'app-okta', assetId: 'a-ciam', name: 'Okta' },
    { id: 'app-azuread', assetId: 'a-ciam', name: 'Azure AD B2C' },
    { id: 'app-keycloak', assetId: 'a-ciam', name: 'Keycloak' },
    // Internet Banking — a-web
    { id: 'app-angular', assetId: 'a-web', name: 'Angular Frontend' },
    { id: 'app-bff', assetId: 'a-web', name: 'BFF Service' },
    // Mobile Banking App — a-mobile
    { id: 'app-ios', assetId: 'a-mobile', name: 'iOS App' },
    { id: 'app-android', assetId: 'a-mobile', name: 'Android App' },
    { id: 'app-rn', assetId: 'a-mobile', name: 'React Native Shell' },
    // ── GEANZ asset applications ──────────────────────────────────────────────
    { id: 'app-gz-fmis',    assetId: 'gz-fmis',    name: 'Financial Management Information System' },
    { id: 'app-gz-authn',   assetId: 'gz-authn',   name: 'Authentication' },
    { id: 'app-gz-email',   assetId: 'gz-email',   name: 'Email applications' },
    { id: 'app-gz-iaas',    assetId: 'gz-iaas',    name: 'Infrastructure as a Service (IaaS)' },
    { id: 'app-gz-gesb',    assetId: 'gz-gesb',    name: 'Enterprise Service Bus (ESB)' },
    { id: 'app-gz-siem',    assetId: 'gz-siem',    name: 'Security Incident and Event Management' },
    { id: 'app-gz-portal',  assetId: 'gz-portal',  name: 'Customer Portal Application Service' },
    { id: 'app-gz-itsm',    assetId: 'gz-itsm',    name: 'ICT Service Management (ITSM)' },
    { id: 'app-gz-apimgmt', assetId: 'gz-apimgmt', name: 'API Management' },
];

export const demoApplicationSegments: ApplicationSegment[] = [
    // Okta — in production across the full visible range
    { id: 'seg-okta-prod', applicationId: 'app-okta', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // Azure AD B2C — in production, then sunset as CIAM migrates to Okta
    { id: 'seg-azuread-prod', applicationId: 'app-azuread', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-azuread-sunset', applicationId: 'app-azuread', status: 'appstatus-sunset', startDate: relDate(0, 7, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-azuread-oos', applicationId: 'app-azuread', status: 'appstatus-out-of-support', startDate: relDate(1, 7, 1), endDate: relDate(2, 6, 30) },
    // Keycloak — planned then funded as a potential alternative
    { id: 'seg-keycloak-planned', applicationId: 'app-keycloak', status: 'appstatus-planned', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30) },
    { id: 'seg-keycloak-funded', applicationId: 'app-keycloak', status: 'appstatus-funded', startDate: relDate(0, 10, 1), endDate: relDate(1, 12, 31) },
    // Angular Frontend — long-running in production
    { id: 'seg-angular-prod', applicationId: 'app-angular', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // BFF Service — in production, moving to sunset as architecture evolves
    { id: 'seg-bff-prod', applicationId: 'app-bff', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-bff-sunset', applicationId: 'app-bff', status: 'appstatus-sunset', startDate: relDate(1, 7, 1), endDate: relDate(2, 12, 31) },
    // iOS App — in production, then eventual React Native consolidation
    { id: 'seg-ios-prod', applicationId: 'app-ios', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-ios-sunset', applicationId: 'app-ios', status: 'appstatus-sunset', startDate: relDate(1, 7, 1), endDate: relDate(2, 6, 30) },
    // Android App — in production throughout
    { id: 'seg-android-prod', applicationId: 'app-android', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // React Native Shell — planned, funded, then in production as consolidation succeeds
    { id: 'seg-rn-planned', applicationId: 'app-rn', status: 'appstatus-planned', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-rn-funded', applicationId: 'app-rn', status: 'appstatus-funded', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31) },
    { id: 'seg-rn-prod', applicationId: 'app-rn', status: 'appstatus-in-production', startDate: relDate(1, 4, 1), endDate: relDate(2, 12, 31) },

    // ── GEANZ asset lifecycle segments ────────────────────────────────────────
    // FMIS — in production, migrating to cloud
    { id: 'seg-gz-fmis-prod',      applicationId: 'app-gz-fmis',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 3, 31) },
    { id: 'seg-gz-fmis-sunset',    applicationId: 'app-gz-fmis',    status: 'appstatus-sunset',        startDate: relDate(1, 4, 1),  endDate: relDate(2, 6, 30), row: 1 },
    // Authentication — current platform phasing out, replacement being funded
    { id: 'seg-gz-authn-prod',     applicationId: 'app-gz-authn',   status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-gz-authn-funded',   applicationId: 'app-gz-authn',   status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(0, 6, 30), row: 1 },
    { id: 'seg-gz-authn-new-prod', applicationId: 'app-gz-authn',   status: 'appstatus-in-production', startDate: relDate(0, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Email — legacy mail in production, M365 funded and going live
    { id: 'seg-gz-email-legacy',   applicationId: 'app-gz-email',   status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-gz-email-m365-fd',  applicationId: 'app-gz-email',   status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(0, 5, 31), row: 1 },
    { id: 'seg-gz-email-m365',     applicationId: 'app-gz-email',   status: 'appstatus-in-production', startDate: relDate(0, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // IaaS — on-prem datacentre running down as cloud ramps up
    { id: 'seg-gz-iaas-onprem',    applicationId: 'app-gz-iaas',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-gz-iaas-cloud-fd',  applicationId: 'app-gz-iaas',    status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(1, 6, 30), row: 1 },
    { id: 'seg-gz-iaas-sunset',    applicationId: 'app-gz-iaas',    status: 'appstatus-sunset',        startDate: relDate(1, 7, 1),  endDate: relDate(2, 6, 30) },
    { id: 'seg-gz-iaas-cloud',     applicationId: 'app-gz-iaas',    status: 'appstatus-in-production', startDate: relDate(1, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Enterprise Service Bus — production until retirement
    { id: 'seg-gz-gesb-prod',      applicationId: 'app-gz-gesb',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    { id: 'seg-gz-gesb-sunset',    applicationId: 'app-gz-gesb',    status: 'appstatus-sunset',        startDate: relDate(1, 1, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // SIEM — platform upgrade in progress
    { id: 'seg-gz-siem-prod',      applicationId: 'app-gz-siem',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 12, 31) },
    { id: 'seg-gz-siem-funded',    applicationId: 'app-gz-siem',    status: 'appstatus-funded',        startDate: relDate(0, 7, 1),  endDate: relDate(1, 3, 31), row: 1 },
    { id: 'seg-gz-siem-new',       applicationId: 'app-gz-siem',    status: 'appstatus-in-production', startDate: relDate(1, 4, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Customer Portal — long-running production service
    { id: 'seg-gz-portal-prod',    applicationId: 'app-gz-portal',  status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // ITSM — in production
    { id: 'seg-gz-itsm-prod',      applicationId: 'app-gz-itsm',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // API Management — in production
    { id: 'seg-gz-api-prod',       applicationId: 'app-gz-apimgmt', status: 'appstatus-in-production', startDate: relDate(0, 1, 1),  endDate: relDate(2, 12, 31) },
];

export const demoInitiatives: Initiative[] = [
    // CIAM
    {
        id: 'i-ciam-passkey', name: 'Passkey Rollout', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'a-ciam', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 350000, opex: 0,
        description: 'Replace SMS OTP with FIDO2 passkeys for all customer-facing channels.',
        status: 'active', progress: 40, ownerId: 'res-4', resourceIds: ['res-2', 'res-3'],
    },
    {
        id: 'i-ciam-sso', name: 'SSO Consolidation', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'a-ciam', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 600000, opex: 0,
        description: 'Unify 12 legacy identity providers into a single CIAM platform.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-3'],
    },
    // Employee IAM
    {
        id: 'i-eiam-ztna', name: 'Zero Trust Network Access', programmeId: 'prog-mod', strategyId: 'strat-zero',
        assetId: 'a-eiam', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 800000, opex: 0,
        description: 'Implement identity-centric perimeter for all internal applications.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // PAM
    {
        id: 'i-pam-vault', name: 'Secrets Vault Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'a-pam', startDate: relDate(0, 3, 1), endDate: relDate(0, 9, 30), capex: 250000, opex: 0,
        description: 'Move from legacy PAM to cloud-native HashiCorp Vault.',
        status: 'active', progress: 10, ownerId: 'res-4', resourceIds: ['res-5'],
    },
    // Data Lake
    {
        id: 'i-lake-ingest', name: 'Real-Time Ingestion', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'a-lake', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 1200000, opex: 0,
        description: 'Kafka-based streaming ingestion pipeline replacing nightly batch ETL.',
        status: 'active', progress: 30, ownerId: 'res-6', resourceIds: ['res-3', 'res-5'],
    },
    {
        id: 'i-lake-gov', name: 'Data Governance Framework', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-lake', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 500000, opex: 0,
        description: 'Implement data lineage, quality scoring, and automated PII tagging.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Data Warehouse
    {
        id: 'i-dwh-snow', name: 'Snowflake Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'a-dwh', startDate: relDate(0, 4, 1), endDate: relDate(1, 3, 31), capex: 2000000, opex: 0,
        description: 'Migrate on-prem Teradata warehouse to Snowflake on AWS.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    // MDM
    {
        id: 'i-mdm-golden', name: 'Golden Customer Record', programmeId: 'prog-cx', strategyId: 'strat-data',
        assetId: 'a-mdm', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 750000, opex: 0,
        description: 'Create single 360° customer view across banking, insurance and wealth.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-3'],
    },
    // Internet Banking
    {
        id: 'i-web-redesign', name: 'Web Platform Redesign', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'a-web', startDate: relDate(0, 1, 1), endDate: relDate(0, 12, 31), capex: 3000000, opex: 0,
        description: 'Complete redesign of the internet banking UIUX using React + Tailwind micro-frontends.',
        status: 'active', progress: 20, ownerId: 'res-1', resourceIds: ['res-2', 'res-6'],
    },
    {
        id: 'i-web-a11y', name: 'WCAG 2.2 AA Compliance', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-web', startDate: relDate(1, 1, 1), endDate: relDate(1, 6, 30), capex: 400000, opex: 0,
        description: 'Accessibility remediation to meet WCAG 2.2 Level AA for all customer journeys.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Mobile Banking
    {
        id: 'i-mobile-rn', name: 'React Native Rewrite', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'a-mobile', startDate: relDate(0, 3, 1), endDate: relDate(1, 6, 30), capex: 4500000, opex: 0,
        description: 'Rewrite native iOS and Android apps as a single React Native codebase.',
        status: 'active', progress: 5, ownerId: 'res-6', resourceIds: ['res-2', 'res-3'],
    },
    // Contact Centre
    {
        id: 'i-cc-ai', name: 'AI-Powered IVR', programmeId: 'prog-cx', strategyId: 'strat-data',
        assetId: 'a-cc', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 900000, opex: 0,
        description: 'Deploy conversational AI to handle 60% of Tier 1 support calls.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Core Ledger
    {
        id: 'i-core-iso', name: 'ISO 20022 Migration', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-core', startDate: relDate(0, 1, 1), endDate: relDate(1, 6, 30), capex: 5000000, opex: 0,
        description: 'Upgrade core messaging to ISO 20022 format for SWIFT and domestic payments.',
        status: 'active', progress: 10, ownerId: 'res-1', resourceIds: ['res-2', 'res-6'],
    },
    {
        id: 'i-core-api', name: 'Core Banking API Layer', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-core', startDate: relDate(1, 1, 1), endDate: relDate(1, 12, 31), capex: 2500000, opex: 0,
        description: 'Wrap legacy COBOL core with gRPC and REST APIs for channel consumption.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // Payments Engine
    {
        id: 'i-pay-rtp', name: 'Real-Time Payments Gateway', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'a-pay', startDate: relDate(0, 4, 1), endDate: relDate(1, 3, 31), capex: 1800000, opex: 0,
        description: 'Connect to the national real-time payments network (NPP/FPS).',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    {
        id: 'i-pay-fraud', name: 'Transaction Fraud ML', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'a-pay', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 700000, opex: 0,
        description: 'Deploy ML models for real-time fraud scoring on all payment channels.',
        status: 'planned', progress: 0, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // API Gateway
    {
        id: 'i-apigw-v2', name: 'API Gateway v2 Migration', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-apigw', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 350000, opex: 0,
        description: 'Migrate from Kong to cloud-native AWS API Gateway with WAF integration.',
        status: 'active', progress: 50, ownerId: 'res-2', resourceIds: ['res-5'],
    },
    {
        id: 'i-apigw-portal', name: 'Developer Portal Launch', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'a-apigw', startDate: relDate(0, 7, 1), endDate: relDate(1, 1, 31), capex: 300000, opex: 0,
        description: 'Self-service developer portal for internal and partner API consumers.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // Enterprise Service Bus
    {
        id: 'i-esb-decomm', name: 'ESB Decommission', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-esb', startDate: relDate(1, 1, 1), endDate: relDate(2, 6, 30), capex: 1200000, opex: 0,
        description: 'Progressively decommission on-prem ESB by migrating integrations to event-driven architecture.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Lending
    {
        id: 'i-lend-auto', name: 'Automated Decisioning', programmeId: 'prog-mod', strategyId: 'strat-data',
        assetId: 'a-lend', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 1500000, opex: 0,
        description: 'New real-time credit scoring engine based on cloud-native decisioning platform.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    {
        id: 'i-lend-open', name: 'Open Banking Origination', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-lend', startDate: relDate(1, 4, 1), endDate: relDate(2, 3, 31), capex: 900000, opex: 0,
        description: 'Integrate CDR/Open Banking data into loan origination for richer affordability checks.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    {
        id: 'i-placeholder-1',
        name: 'Future Strategy',
        programmeId: 'prog-dtp',
        strategyId: 'strat-cloud',
        assetId: 'a-k8s',
        startDate: relDate(2, 1, 1),
        endDate: relDate(2, 12, 31),
        capex: 0, opex: 0,
        description: 'Placeholder for future cloud-native workloads.',
        status: 'planned', progress: 0,
        isPlaceholder: true
    },

    // ── GEANZ initiatives ─────────────────────────────────────────────────────
    // TAP.01 — FMIS
    {
        id: 'i-gz-fmis-cloud', name: 'FMIS Cloud Uplift', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-fmis', startDate: relDate(0, 1, 1), endDate: relDate(1, 3, 31), capex: 1800000, opex: 0,
        description: 'Migrate on-premises FMIS to a SaaS financial management platform.',
        status: 'active', progress: 20, ownerId: 'res-1', resourceIds: ['res-5'],
    },
    // TAP.01 — HR Management
    {
        id: 'i-gz-hrm-selfserv', name: 'HR Self-Service Portal', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'gz-hrm', startDate: relDate(0, 4, 1), endDate: relDate(0, 12, 31), capex: 400000, opex: 0,
        description: 'Deploy employee self-service module for leave, payslips and benefits.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    // TAP.01 — ERP
    {
        id: 'i-gz-erp-consolidate', name: 'ERP Consolidation', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'gz-erp', startDate: relDate(1, 1, 1), endDate: relDate(2, 6, 30), capex: 3500000, opex: 0,
        description: 'Consolidate fragmented back-office systems into a single cloud ERP.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // TAP.02 — Case Management
    {
        id: 'i-gz-case-upgrade', name: 'Case Management Upgrade', programmeId: 'prog-mod', strategyId: 'strat-cust',
        assetId: 'gz-case', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 850000, opex: 0,
        description: 'Replace legacy case system with a cloud-native, API-first case platform.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-2'],
    },
    // TAP.02 — CRM
    {
        id: 'i-gz-crm-migrate', name: 'CRM Cloud Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-crm', startDate: relDate(0, 3, 1), endDate: relDate(1, 1, 31), capex: 1200000, opex: 0,
        description: 'Migrate on-premises CRM to cloud, integrating with citizen portal and case management.',
        status: 'active', progress: 10, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // TAP.03 — Customer Portal
    {
        id: 'i-gz-portal-redesign', name: 'Citizen Portal Redesign', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'gz-portal', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 600000, opex: 0,
        description: 'Redesign the citizen-facing portal to meet NZ Government Design System standards.',
        status: 'active', progress: 35, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // TAP.03 — Web CMS
    {
        id: 'i-gz-wcm-headless', name: 'Headless CMS Migration', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'gz-wcm', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 300000, opex: 0,
        description: 'Move from monolithic CMS to headless architecture to support omnichannel publishing.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // TAP.04 — Data Governance
    {
        id: 'i-gz-datagov-prog', name: 'Data Governance Programme', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'gz-datagov', startDate: relDate(0, 1, 1), endDate: relDate(1, 3, 31), capex: 500000, opex: 0,
        description: 'Establish agency-wide data governance: lineage, quality scoring, PII classification.',
        status: 'active', progress: 20, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // TAP.04 — Records Management
    {
        id: 'i-gz-records-digital', name: 'Digital Records Uplift', programmeId: 'prog-dtp', strategyId: 'strat-reg',
        assetId: 'gz-records', startDate: relDate(0, 7, 1), endDate: relDate(1, 6, 30), capex: 400000, opex: 0,
        description: 'Digitise paper records and align with NZ Archives digital continuity requirements.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    // TAP.06 — API Management
    {
        id: 'i-gz-api-platform', name: 'API Platform Uplift', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'gz-apimgmt', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 750000, opex: 0,
        description: 'Upgrade API gateway and developer portal to support whole-of-government API integration.',
        status: 'active', progress: 60, ownerId: 'res-2', resourceIds: ['res-5'],
    },
    // TAP.06 — ESB
    {
        id: 'i-gz-esb-retire', name: 'ESB Retirement Programme', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'gz-gesb', startDate: relDate(1, 1, 1), endDate: relDate(2, 12, 31), capex: 2000000, opex: 0,
        description: 'Decommission legacy ESB by migrating all integrations to event-driven API patterns.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // TAP.07 — Identity Governance
    {
        id: 'i-gz-idgov-jml', name: 'Joiner/Mover/Leaver Automation', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'gz-idgov', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 450000, opex: 0,
        description: 'Automate identity lifecycle across HR, directory and application provisioning.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // TAP.07 — Authentication
    {
        id: 'i-gz-authn-mfa', name: 'MFA Modernisation', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'gz-authn', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 250000, opex: 0,
        description: 'Replace SMS OTP with phishing-resistant MFA (FIDO2/passkeys) for all staff.',
        status: 'active', progress: 75, ownerId: 'res-4', resourceIds: ['res-3'],
    },
    // TAP.08 — Network Security
    {
        id: 'i-gz-netsec-seg', name: 'Network Segmentation Project', programmeId: 'prog-mod', strategyId: 'strat-zero',
        assetId: 'gz-netsec', startDate: relDate(0, 3, 1), endDate: relDate(1, 3, 31), capex: 900000, opex: 0,
        description: 'Implement micro-segmentation across agency network to reduce lateral movement risk.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // TAP.08 — SIEM
    {
        id: 'i-gz-siem-upgrade', name: 'SIEM Platform Upgrade', programmeId: 'prog-mod', strategyId: 'strat-reg',
        assetId: 'gz-siem', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 650000, opex: 0,
        description: 'Upgrade SIEM to support NZISM-aligned security monitoring and automated alerting.',
        status: 'planned', progress: 0, ownerId: 'res-4', resourceIds: ['res-5'],
    },
    // TAP.09 — BPM
    {
        id: 'i-gz-bpm-automate', name: 'Process Automation Initiative', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'gz-bpm', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 800000, opex: 0,
        description: 'Automate high-volume ministerial and regulatory approval workflows using BPM tooling.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // TAP.12 — ITSM
    {
        id: 'i-gz-itsm-consolidate', name: 'ITSM Tool Consolidation', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'gz-itsm', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 350000, opex: 0,
        description: 'Consolidate three agency service desk tools into a single enterprise ITSM platform.',
        status: 'active', progress: 45, ownerId: 'res-6',
    },
    // TAP.12 — CMDB
    {
        id: 'i-gz-cmdb-auto', name: 'CMDB Automation', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-cmdb', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 300000, opex: 0,
        description: 'Automate CMDB discovery and reconciliation with cloud infrastructure inventory.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // TAP.13 — Email
    {
        id: 'i-gz-email-m365', name: 'Microsoft 365 Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-email', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 400000, opex: 0,
        description: 'Migrate agency email from on-premises Exchange to Microsoft 365.',
        status: 'active', progress: 80, ownerId: 'res-5', resourceIds: ['res-3'],
    },
    // TAP.13 — Video Services
    {
        id: 'i-gz-video-upgrade', name: 'Video Conferencing Uplift', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'gz-video', startDate: relDate(0, 7, 1), endDate: relDate(0, 12, 31), capex: 150000, opex: 0,
        description: 'Standardise video conferencing across all meeting rooms and remote workers.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // TAP.14 — System Monitoring
    {
        id: 'i-gz-sysmon-unified', name: 'Unified Monitoring Platform', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-sysmon', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 500000, opex: 0,
        description: 'Consolidate fragmented monitoring tools into a single observability platform.',
        status: 'planned', progress: 0, ownerId: 'res-5', resourceIds: ['res-6'],
    },
    // TAP.14 — APM
    {
        id: 'i-gz-apm-rollout', name: 'APM Rollout', programmeId: 'prog-cloud', strategyId: 'strat-api',
        assetId: 'gz-apm', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 250000, opex: 0,
        description: 'Deploy application performance monitoring across all public-facing digital services.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // TAP.15 — IaaS
    {
        id: 'i-gz-iaas-migration', name: 'IaaS Cloud Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-iaas', startDate: relDate(0, 1, 1), endDate: relDate(1, 6, 30), capex: 2500000, opex: 0,
        description: 'Exit on-premises datacentre by migrating all workloads to government cloud tenancy.',
        status: 'active', progress: 25, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    // TAP.15 — PaaS
    {
        id: 'i-gz-paas-k8s', name: 'Container Platform (PaaS)', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'gz-paas', startDate: relDate(0, 6, 1), endDate: relDate(1, 6, 30), capex: 800000, opex: 0,
        description: 'Establish shared Kubernetes-based PaaS for agency application workloads.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // TAP.16 — Data Warehouse
    {
        id: 'i-gz-dwh-cloud', name: 'Cloud Data Warehouse', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'gz-dwh', startDate: relDate(0, 4, 1), endDate: relDate(1, 6, 30), capex: 1800000, opex: 0,
        description: 'Replace on-premises data warehouse with cloud-native analytical database.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // TAP.16 — BI Reporting
    {
        id: 'i-gz-bi-selfserv', name: 'Self-Service BI Platform', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'gz-bi', startDate: relDate(0, 10, 1), endDate: relDate(1, 9, 30), capex: 600000, opex: 0,
        description: 'Deploy self-service BI tooling enabling business units to create their own reports.',
        status: 'planned', progress: 0, ownerId: 'res-2', resourceIds: ['res-3'],
    },
];

export const demoDependencies: Dependency[] = [
    { id: 'dep-1', sourceId: 'i-ciam-passkey', targetId: 'i-ciam-sso', type: 'blocks' },
    { id: 'dep-2', sourceId: 'i-lake-ingest', targetId: 'i-lake-gov', type: 'blocks' },
    { id: 'dep-3', sourceId: 'i-web-redesign', targetId: 'i-web-a11y', type: 'blocks' },
    { id: 'dep-5', sourceId: 'i-apigw-v2', targetId: 'i-apigw-portal', type: 'blocks' },
    { id: 'dep-6', sourceId: 'i-core-iso', targetId: 'i-core-api', type: 'blocks' },
    { id: 'dep-7', sourceId: 'i-pay-rtp', targetId: 'i-pay-fraud', type: 'requires' },
    { id: 'dep-8', sourceId: 'i-dwh-snow', targetId: 'i-mdm-golden', type: 'requires' },
    { id: 'dep-9', sourceId: 'i-apigw-v2', targetId: 'i-esb-decomm', type: 'blocks' },
    { id: 'dep-10', sourceId: 'i-lend-auto', targetId: 'i-lend-open', type: 'blocks' },
];

export const demoMilestones: Milestone[] = [
    { id: 'ms-1', assetId: 'a-core', date: relDate(0, 11, 1), name: 'SWIFT ISO 20022 Deadline', type: 'critical' },
    { id: 'ms-2', assetId: 'a-web', date: relDate(1, 7, 1), name: 'WCAG Compliance Audit', type: 'critical' },
    { id: 'ms-3', assetId: 'a-pay', date: relDate(1, 4, 1), name: 'NPP Go-Live', type: 'critical' },
    { id: 'ms-4', assetId: 'a-mobile', date: relDate(1, 7, 1), name: 'App Store Launch', type: 'warning' },
    { id: 'ms-5', assetId: 'a-k8s', date: relDate(0, 10, 1), name: 'DR Failover Test', type: 'warning' },
    { id: 'ms-6', assetId: 'a-esb', date: relDate(2, 7, 1), name: 'ESB End of Life', type: 'critical' },
    { id: 'ms-7', assetId: 'a-lake', date: relDate(1, 1, 1), name: 'Batch ETL Sunset', type: 'warning' },
    { id: 'ms-8', assetId: 'a-lend', date: relDate(1, 10, 1), name: 'Open Banking Phase 3', type: 'info' },
    // GEANZ milestones
    { id: 'ms-gz-1', assetId: 'gz-fmis',    date: relDate(0, 6, 30),  name: 'FMIS Contract Renewal Decision', type: 'warning' },
    { id: 'ms-gz-2', assetId: 'gz-email',   date: relDate(0, 6, 30),  name: 'M365 Cutover Complete',           type: 'critical' },
    { id: 'ms-gz-3', assetId: 'gz-iaas',    date: relDate(1, 6, 30),  name: 'Datacentre Exit Deadline',        type: 'critical' },
    { id: 'ms-gz-4', assetId: 'gz-gesb',    date: relDate(2, 12, 31), name: 'ESB End of Life',                 type: 'critical' },
    { id: 'ms-gz-5', assetId: 'gz-authn',   date: relDate(0, 6, 30),  name: 'MFA Rollout Complete',            type: 'info' },
    { id: 'ms-gz-6', assetId: 'gz-datagov', date: relDate(1, 3, 31),  name: 'Data Governance Framework Live',  type: 'info' },
];

export const demoResources: Resource[] = [
    { id: 'res-1', name: 'Sarah Chen', role: 'Programme Manager' },
    { id: 'res-2', name: 'James Okafor', role: 'Enterprise Architect' },
    { id: 'res-3', name: 'Business Analyst' },
    { id: 'res-4', name: 'Maria Santos', role: 'Security Architect' },
    { id: 'res-5', name: 'Cloud Engineer' },
    { id: 'res-6', name: 'Tom Wright', role: 'Tech Lead' },
];

export const demoApplicationStatuses: ApplicationStatus[] = [
    { id: 'appstatus-planned',        name: 'Planned',          color: 'bg-slate-400' },
    { id: 'appstatus-funded',         name: 'Funded',           color: 'bg-blue-400' },
    { id: 'appstatus-in-production',  name: 'In Production',    color: 'bg-emerald-500' },
    { id: 'appstatus-sunset',         name: 'Sunset',           color: 'bg-amber-500' },
    { id: 'appstatus-out-of-support', name: 'Out of Support',   color: 'bg-orange-500' },
    { id: 'appstatus-retired',        name: 'Retired',          color: 'bg-slate-300' },
];
