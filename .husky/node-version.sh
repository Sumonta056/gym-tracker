# Git hooks do not inherit an interactive shell, so nvm is usually absent and the
# system Node runs instead. jsdom 30 needs Node 21 or newer. Load .nvmrc, then stop
# with a clear message when the version is still wrong.

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "husky: node is not on the PATH."
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 25 ]; then
  echo "husky: this repository needs Node 25, found $(node -v)."
  echo "husky: run 'nvm install 25 && nvm use 25', then try again."
  exit 1
fi
