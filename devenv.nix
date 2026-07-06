{ pkgs, lib, config, ... }:

{
  # https://devenv.sh/basics/
  env.PORT = "8191";
  env.NEXT_TELEMETRY_DISABLED = "1";
  env.DATABASE_URL = "postgresql://dora:dora@localhost:5432/dora";

  # https://devenv.sh/packages/
  packages = with pkgs; [ git jq ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm.enable = true;
  };

  # https://devenv.sh/supported-services/postgres/
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_16;
    listen_addresses = "127.0.0.1";
    initialDatabases = [{ name = "dora"; }];
    initialScript = ''
      CREATE ROLE dora WITH LOGIN PASSWORD 'dora' SUPERUSER;
    '';
  };

  # https://devenv.sh/processes/
  # `devenv up` starts postgres + the portal together.
  processes.portal.exec = "npm run dev";

  enterShell = ''
    echo "DORA Dashboard devenv shell"
    echo "  node: $(node --version)  npm: $(npm --version)"
    echo ""
    echo "  npm install   # install deps"
    echo "  devenv up     # start PostgreSQL + portal (http://localhost:8191)"
    echo "  npm run dev   # portal only"
  '';
}
