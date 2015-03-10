# apigeeOrgAdmin
Used to administrate apigee organizations: orgs, pods, apis, developers ... all of it.

# Example usage
Assuming you've only git cloned this source you can simply do the following
>npm install

>node lib/cli.js -o acme -b http://{managementServerHost}:{managementServerPort} -u user@mail.com -c export -d ~/testDest

# Options
Pretty straightforward options
  * -o  -> organization
  * -b  -> baseurl (if not defined it assumes https://api.enterprise.apigee.com )
  * -u  -> your username for login
  * -c  -> command: import or export. Only export supported at this time
  * -d  -> destination directory
  * -D  -> turn on verbose logging info
  * -l  -> supply your own comma delimited list for export/import (should be based of api mgmt uri paths)
      # for example -l apiproducts,apps,developers

This should export everything into the destination directory.

Import mode is now working for most things. I need to clean up how and when I recurse for additional data so that I can get things like key/value maps and host alias support working as desired. It is working well for proxies, apiproducts, developers and so on.
