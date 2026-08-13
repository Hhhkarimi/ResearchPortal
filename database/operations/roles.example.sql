-- Run as a database owner and adapt role names/password management to your provider.
-- Do not commit passwords to this repository.

create role portal_api_readonly nologin;
grant usage on schema research_portal to portal_api_readonly;
grant select on all tables in schema research_portal to portal_api_readonly;
alter default privileges in schema research_portal grant select on tables to portal_api_readonly;

create role portal_ingestor nologin;
grant usage on schema research_portal to portal_ingestor;
grant select,insert,update,delete on all tables in schema research_portal to portal_ingestor;
grant usage,select on all sequences in schema research_portal to portal_ingestor;

-- Create provider-specific login roles separately, then grant one of the roles above.
-- grant portal_api_readonly to portal_web_login;
-- grant portal_ingestor to portal_pipeline_login;
