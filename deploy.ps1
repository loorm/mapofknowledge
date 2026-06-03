$key = "$PSScriptRoot\mapofknowledge.pub"
ssh -i $key virt147958@217.146.69.48 "cd ~/domeenid/www.themapofknowledge.com/htdocs && git pull origin prod && pm2 restart mok-server --update-env && echo 'Deploy complete'"
