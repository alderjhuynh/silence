#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "write a commit message idiot"
    exit 1
fi

git add .
git commit -m "$1"
git push