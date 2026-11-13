#!/bin/sh
installer_dir=${0%/*}
if [ "$installer_dir" = "$0" ]; then installer_dir=.; fi
exec /bin/sh "$installer_dir/install.sh" "$@"
