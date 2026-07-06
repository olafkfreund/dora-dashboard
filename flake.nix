{
  description = "DORA Dashboard — self-hosted delivery-intelligence portal (Next.js + PostgreSQL)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "dora-dashboard";

          packages = with pkgs; [
            nodejs_24
            nodejs_24.pkgs.npm
            postgresql_16
            # tooling
            git
            jq
          ];

          env = {
            PORT = "8191";
            NEXT_TELEMETRY_DISABLED = "1";
          };

          shellHook = ''
            echo "DORA Dashboard dev shell"
            echo "  node:     $(node --version)"
            echo "  npm:      $(npm --version)"
            echo "  postgres: $(postgres --version | awk '{print $3}')"
            echo ""
            echo "  npm install      # install dependencies"
            echo "  npm run dev      # start portal on http://localhost:8191"
          '';
        };
      });
}
