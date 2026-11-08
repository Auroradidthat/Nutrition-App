#!/usr/bin/env bash
# Copies front-end changes (HTML, CSS, JS under public/) from the DEV_NUTRITION_APP
# repo into this one, behind an approval gate. Nothing else is touched: no Worker code
# (src/), no wrangler.toml, no package files, no workflows, no docs, no public/_headers.
#
# Source: the COMMITTED state of DEV's branch (default: dev). Uncommitted DEV work is
# never copied. The script never commits, pushes or deletes; after it copies, review
# `git diff` and commit on this repo yourself (deploys still run through GitHub Actions).
#
# THE GATE (--apply only runs if both parts pass):
#   1. Automated checks on the DEV version of every changed file. Any failure blocks the
#      sync and there is no override: JS syntax, no inline <script>/<style>/style="..."/
#      onclick="..." (the site's CSP blocks them), no hosts outside the CSP allowlist,
#      no data: URIs, and the form/list ids that script.js needs must still exist.
#   2. Human approval of the exact content. The script prints the diff and a fingerprint
#      of the changed files. You approve by typing that fingerprint when prompted, or by
#      passing it as APPROVE=<fingerprint> when there is no terminal. A fingerprint from
#      an earlier run no longer matches once the files change, so approval can't go stale.
#
#   scripts/sync-from-dev.sh                      # checks + diff + fingerprint, writes nothing
#   scripts/sync-from-dev.sh --apply              # same, then asks you to type the fingerprint
#   APPROVE=ab12cd34 scripts/sync-from-dev.sh --apply   # non-interactive approval
#
# Overrides: DEV_DIR (default ../DEV_NUTRITION_APP), DEV_BRANCH (default dev).
# Approvals are appended to .git/sync-approvals.log (local, untracked).

set -euo pipefail

DEV_DIR="${DEV_DIR:-../DEV_NUTRITION_APP}"
BRANCH="${DEV_BRANCH:-dev}"
APPLY=0
case "${1:-}" in
  "") ;;
  --apply) APPLY=1 ;;
  *) echo "Usage: $0 [--apply]" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."

git -C "$DEV_DIR" rev-parse --verify -q "$BRANCH^{commit}" >/dev/null \
  || { echo "Cannot find branch '$BRANCH' in $DEV_DIR" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required for the syntax check" >&2; exit 1; }

echo "From: $DEV_DIR @ $BRANCH ($(git -C "$DEV_DIR" rev-parse --short "$BRANCH"))"

# Uncommitted front-end edits in DEV are ignored; say so rather than surprise anyone.
if [ -n "$(git -C "$DEV_DIR" status --porcelain -- public)" ]; then
  echo "Note: DEV has uncommitted changes in public/. They are NOT copied (commit them on '$BRANCH' first)."
fi

# --- Work out what would change ---------------------------------------------------
changed=()
fp_input=""
while IFS= read -r path; do
  dev_blob=$(git -C "$DEV_DIR" rev-parse "$BRANCH:$path")
  if [ -f "$path" ]; then
    # hash-object applies this repo's line-ending rules, so CRLF working copies compare equal
    prod_blob=$(git hash-object --path="$path" "$path")
    [ "$dev_blob" = "$prod_blob" ] && continue
    echo "  changed  $path"
  else
    echo "  new      $path"
  fi
  changed+=("$path")
  fp_input+="$path:$dev_blob"$'\n'
done < <(git -C "$DEV_DIR" ls-tree -r --name-only "$BRANCH" -- public | grep -E '\.(html|css|js)$' | sort)

if [ "${#changed[@]}" -eq 0 ]; then
  echo "Front end already in sync. Nothing to do."
  exit 0
fi

fingerprint=$(printf '%s' "$fp_input" | sha256sum | cut -c1-8)

# Stage the DEV versions in a temp dir: checks and the diff both read from here.
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
for p in "${changed[@]}"; do
  mkdir -p "$stage/$(dirname "$p")"
  git -C "$DEV_DIR" show "$BRANCH:$p" > "$stage/$p"
done

# --- Gate part 1: automated checks ------------------------------------------------
fail=0
bad() { echo "  FAIL  $1"; fail=1; }

echo
echo "Checks:"
for p in "${changed[@]}"; do
  f="$stage/$p"
  case "$p" in
    *.js)
      # These are browser ES modules. `node --check` skips the real parse when it
      # auto-detects a module from a .js name, so check a copy named .mjs instead.
      cp "$f" "$f.mjs"
      node --check "$f.mjs" >/dev/null 2>&1 || bad "$p: JavaScript syntax error"
      rm -f "$f.mjs"
      ;;
    *.html)
      grep -nP '<script\b(?![^>]*\bsrc=)' "$f" >/dev/null && bad "$p: inline <script> (blocked by the CSP)"
      grep -nPi '\son[a-z]+\s*=' "$f" >/dev/null && bad "$p: inline event handler such as onclick= (blocked by the CSP)"
      grep -nPi '<style\b|\sstyle\s*=' "$f" >/dev/null && bad "$p: inline style (blocked by the CSP; use styles.css)"
      ;;
  esac
  case "$p" in
    *.html|*.css|*.js)
      grep -nF 'data:' "$f" >/dev/null && bad "$p: data: URI (blocked by the CSP img-src)"
      # Only these hosts are allowed by public/_headers (plus the SVG/XML namespace).
      for host in $(grep -ohE 'https?://[^"'"'"' )<>]+' "$f" | sed -E 's#https?://([^/:]+).*#\1#' | sort -u); do
        case "$host" in
          fonts.googleapis.com|fonts.gstatic.com|www.w3.org) ;;
          *) bad "$p: external host $host is not in the CSP allowlist" ;;
        esac
      done
      ;;
  esac
done
# script.js looks these ids up; losing one breaks the page silently.
if [ -f "$stage/public/index.html" ]; then
  for id in add-form item-input quantity-input add-btn status item-list; do
    grep -qE "id=\"$id\"" "$stage/public/index.html" || bad "public/index.html: required id \"$id\" is missing"
  done
fi
if [ "$fail" -ne 0 ]; then
  echo
  echo "Blocked: fix the failures above in DEV, commit them on '$BRANCH', and run again."
  exit 1
fi
echo "  all passed (${#changed[@]} file(s))"

# --- Show exactly what would change -----------------------------------------------
echo
echo "Diff (PROD -> DEV version):"
for p in "${changed[@]}"; do
  if [ -f "$p" ]; then
    echo "=== $p"
    # exit status 1 just means "files differ"; the warnings are about line endings only
    git diff --no-index --ignore-cr-at-eol --unified=2 -- "$p" "$stage/$p" 2>/dev/null | tail -n +5 || true
  else
    echo "--- new file: $p ($(wc -l < "$stage/$p") lines)"
  fi
done
for p in "${changed[@]}"; do
  [ "$p" = "public/rules.js" ] && echo "Warning: public/rules.js is also imported by the Worker, so this changes server-side validation. Test the API before merging to main."
done

echo
echo "Fingerprint: $fingerprint   (${#changed[@]} file(s))"

if [ "$APPLY" -eq 0 ]; then
  echo "Dry run, nothing written. To approve and copy: scripts/sync-from-dev.sh --apply"
  exit 0
fi

# --- Gate part 2: approval tied to this exact content ------------------------------
approved=""
if [ -n "${APPROVE:-}" ]; then
  approved="$APPROVE"
elif [ -t 0 ]; then
  read -r -p "Type the fingerprint to approve, anything else cancels: " approved
else
  echo "Not approved: no terminal to ask on. Re-run with APPROVE=$fingerprint to approve this exact change." >&2
  exit 1
fi
if [ "$approved" != "$fingerprint" ]; then
  echo "Not approved (fingerprint did not match). Nothing was copied." >&2
  exit 1
fi

for p in "${changed[@]}"; do
  mkdir -p "$(dirname "$p")"
  cp "$stage/$p" "$p"
done
printf '%s approved %s from %s@%s: %s\n' "$(date -u +%FT%TZ)" "$fingerprint" "$BRANCH" \
  "$(git -C "$DEV_DIR" rev-parse --short "$BRANCH")" "${changed[*]}" >> "$(git rev-parse --git-dir)/sync-approvals.log"
echo "Approved. Copied ${#changed[@]} file(s). Review with 'git diff', then commit on this repo."
