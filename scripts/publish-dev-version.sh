#!/bin/bash
#
# A script to quickly publish a dev version of a package using changesets and cleanup afterwards.
#
# Usage:
# ./scripts/publish-dev-package.sh <package-name>
#
# NOTE: "@typed-rest/" will be prepended to the package name if it's missing
# Example: ./scripts/publish-dev-package.sh pratiq-rest # will publish @typed-rest/pratiq-rest

# Check if changeset already exists (or if no changes were made)
# if pnpm changeset status > /dev/null 2>&1; then
#   echo "Either no changes were detected or there's already an existing changeset active."
#   exit 1
# fi

AFFECTED_FILES=$(git diff-index --name-only HEAD | grep -E '(package.json|CHANGELOG.md)$')

# if there are changes to package.json or CHANGELOG.md, exit with error
if [[ -n "$AFFECTED_FILES" ]]; then
    echo "Changes to package.json or CHANGELOG.md detected. Please commit these files before publishing."
    exit 1
fi

PACKAGE_NAME=$1
if [[ -z "$PACKAGE_NAME" ]]; then
    echo "Please provide a package name"
    exit 1
fi

# Prepend @typed-rest with package name if it's missing
if [[ ! $PACKAGE_NAME =~ ^@ ]]; then
    PACKAGE_NAME="@typed-rest/${PACKAGE_NAME}"
    echo "Prepended @typed-rest/ to package name"
fi
echo "Package name: $PACKAGE_NAME"

# Fetch all non-private (publishable) packages in monorepo
POSSIBLE_PACKAGE_NAMES=$(pnpm list -r --depth -1 --json | jq -r '.[] | select(.private == false) | .name')
if [[ ! $POSSIBLE_PACKAGE_NAMES =~  (^|[[:space:]])$PACKAGE_NAME($|[[:space:]]) ]]; then
    echo "Package name $PACKAGE_NAME not found in monorepo"
    echo "Possible package names:"
    echo "$POSSIBLE_PACKAGE_NAMES"
    exit 1
fi


CHANGESET_CONTENT="---
'$PACKAGE_NAME': patch
---"
CHANGESET_FILE=$(mktemp ./.changeset/XXXXXXXXXXX.md)
echo "$CHANGESET_CONTENT" > $CHANGESET_FILE

# Ensure changeset file is valid
pnpm changeset status

if [ $? -eq 0 ]; then
    echo "Changeset file is valid"
    pnpm changeset:snapshot:version
    pnpm changeset:snapshot:publish
else
    echo "pnpm changeset status failed"
fi

# Cleanup
rm -f $CHANGESET_FILE
AFFECTED_FILES=$(git diff-index --name-only HEAD | grep -E '(package.json|CHANGELOG.md)$')
git restore $AFFECTED_FILES
echo "Restored package.json and CHANGELOG.md files to their original state"