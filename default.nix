{ pkgs, depot, ... }:

(pkgs.writeText "source.txt" ''
  ${depot.third_party.gitignoreSource ./.}
'').overrideAttrs (_: {
  meta.ci.extraSteps.github = depot.tools.releases.filteredGitPush {
    filter = ":/users/wpcarro/slx.js";
    remote = "git@github.com:wpcarro/slx.js.git";
    ref = "refs/heads/canon";
  };
})
