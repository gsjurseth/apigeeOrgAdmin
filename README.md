# apigeeOrgAdmin
Used to administrate apigee organizations: orgs, pods, apis, developers ... all of it.

# Example usage
Assuming you've only git cloned this source you can simply do the following
  npm install
  node lib/cli.js -o acme -b http://{managementServerHost}:{managementServerPort} -u user@mail.com -c export -d ~/testDest

Optionally you can supply the -D option for debug output (quite verbose) or the -l option to specify your own list for export.

This should export everything into the destination directory. Import mode is forthcoming
