#!/bin/sh
# Start from this copy of the repository, even when launched from another folder.
installer_dir=${0%/*}
if [ "$installer_dir" = "$0" ]; then installer_dir=.; fi
CDPATH= cd -P "$installer_dir" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo 'PrivacyPal needs Node 24. Install/select Node 24, then run this installer again.' >&2
  echo 'Instructions: INSTALL.md' >&2
  exit 1
fi
installer_node_version=$(node --version 2>/dev/null)
case "$installer_node_version" in
  v24.*) ;;
  *) echo "PrivacyPal needs Node 24; found ${installer_node_version:-an unavailable runtime}. Select Node 24 and try again." >&2; exit 1 ;;
esac
if ! command -v npm >/dev/null 2>&1; then
  echo 'PrivacyPal needs npm, supplied with Node 24. Select that installation and try again.' >&2
  exit 1
fi
exec npm run deploy:wizard -- "$@"
