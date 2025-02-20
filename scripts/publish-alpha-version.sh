#!/bin/bash

if ! git diff-index --quiet HEAD --; then
    echo "There are changes in the repository. Please commit or stash them before proceeding."
    exit 1
fi


pnpm changeset version
git commit -am "chore: increment version"
git push
pnpm changeset publish
