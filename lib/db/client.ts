import "server-only";

import postgres, {type Sql} from "postgres";

const globalForDatabase=globalThis as typeof globalThis&{
  researchPortalSql?:Sql;
};

function integerSetting(name:string,fallback:number){
  const value=Number(process.env[name]??fallback);
  if(!Number.isInteger(value)||value<=0)throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function getDatabase():Sql{
  if(globalForDatabase.researchPortalSql)return globalForDatabase.researchPortalSql;

  const connectionString=process.env.DATABASE_URL;
  if(!connectionString)throw new Error("DATABASE_URL is required when DATA_BACKEND=postgres.");

  const client=postgres(connectionString,{
    max:integerSetting("DATABASE_MAX_CONNECTIONS",5),
    idle_timeout:integerSetting("DATABASE_IDLE_TIMEOUT_SECONDS",20),
    connect_timeout:integerSetting("DATABASE_CONNECT_TIMEOUT_SECONDS",10),
    ssl:process.env.DATABASE_SSL==="true"?"require":false,
    prepare:true,
    onnotice:()=>undefined,
    connection:{
      application_name:"research-portal-web",
      statement_timeout:integerSetting("DATABASE_STATEMENT_TIMEOUT_MS",3000),
      idle_in_transaction_session_timeout:10000,
    },
  });

  if(process.env.NODE_ENV!=="production")globalForDatabase.researchPortalSql=client;
  return client;
}

export function postgresEnabled(){
  return process.env.DATA_BACKEND==="postgres"||process.env.DATA_BACKEND==="shadow";
}
