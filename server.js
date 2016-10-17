var http = require("http");
var crypto = require('crypto');
var fs = require('fs');
function freebox(){
    
    this.url="mafreebox.free.fr";
    this.box;
    this.id='fr.freebox.node';
    this.token=null;
    this.sessionToken=null;
    this.track_id=false;
    this.debug = true;
    
    this.init = function(id, token, cb){
        if(typeof id!='undefined') this.id = id;
        this.id=id;
        this.token = token;
        this.version(cb); 
    }
    this.version=function(cb) {
        var req = http.request({
            host: this.url,
            port: 80,
            path: "/api_version",
            method: 'GET'
          }, function(res) {
            res.setEncoding('utf8');
            var content='';
            res.on('data', function (chunk) {
              content+=chunk;
            });
            res.on('end', function () {
             this.box=JSON.parse(content);
             if(typeof cb=='function') cb();
            }.bind(this));
          }.bind(this));
          req.end();

//        return this.box=json_decode(content);
    }
    this.call = function(api_url,params, method,cb) {
        if (!method) method=(!params)?'GET':'POST';
        var urk = this.box.api_base_url+'v'+(this.box.api_version*1)+'/'+api_url;
        if (this.debug) console.log("\n ---- "+urk);
        
        var p = {
            host: this.url,
            port: 80,
            path: urk,
            method: method,
             headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(JSON.stringify(params))
              }
          };
          if(this.sessionToken){
              p.headers['X-Fbx-App-Auth']=this.sessionToken;
          }
        var req = http.request(p, function(res) {
//            console.log('STATUS: ' + res.statusCode);
//            console.log('HEADERS: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');
            var content='';
            res.on('data', function (chunk) {
//              console.log('BODY: ' + chunk);
              content+=chunk;
            });
            res.on('error', function (e) {
              console.log(e);
//              content+=chunk;
            });
            res.on('end', function () {
                try{
                    content=JSON.parse(content)
                }
                catch(e){}
                
                if(typeof cb=='function') cb(content);
            });            
          });
          req.write(JSON.stringify(params));
          req.end();
    }
    this.authorize=function(name,cb) {
        fs.exists('track_id.txt', function(exists) {
            var url = "login/authorize";
            if(exists){     
                try{
                var ids = JSON.parse(fs.readFileSync('track_id.txt', 'utf8'));
//                console.log('from file : '+id)
                if(parseInt(ids.track_id,10)){
                    this.track_id = ids.track_id;
                    this.token = ids.token;
                    url = "login/authorize/"+this.track_id;
                }
            }
            catch(e){}
            }
            this.call(url, (this.track_id?false:{
                    'app_id':this.id,
                    'app_name':name,
                    'app_version'    :this.box.api_version*1,
                    'device_name'    :this.box.device_name
                }),false,function(r){
                    try{r=JSON.parse(r);}
                    catch(e){}
                    console.log('retour authorize')
                    console.log(r)
                    if (r.success){
                        if(r.result.status=='timeout' || r.result.status=='denied'){
                            fs.unlink('track_id.txt')
                            return;
                            
                        }
                        if(parseInt(r.result.track_id,10)){
                            this.token=r.result.app_token;
                            this.track_id =r.result.track_id;
                            fs.writeFile('track_id.txt', JSON.stringify({track_id:this.track_id,token:this.token}) , function (err) {
                                if (err) throw err;
    //                            console.log('It\'s saved!');
                                if(typeof cb=='function') cb(false);
                              });
                          }
                          else if(typeof cb=='function') cb(true);
                    }
                }.bind(this));
          }.bind(this));
    }
    
    this.login=function(cb) {
        this.call("login",{},'GET',function(rc){
            try{rc=JSON.parse(rc);}
            catch(e){}
            console.log("retour login"+this.token)
            console.log(rc)
            var password = crypto.createHmac('sha1', this.token).update(rc.result.challenge).digest('hex');
//            console.log('password : '+password)            
            this.call("login/session",{'app_id' :this.id,'password' :password},'POST',
                    function(r){
                        try{r=JSON.parse(r);}
                        catch(e){}
                        console.log("retour session")
                        console.log(r)
                        if (r.success) this.sessionToken=r.result.session_token;
                        if(typeof cb=='function') cb();
                }.bind(this));
                
                
        }.bind(this));
    }
    
    this.network = function(cb){
        console.log('interfaces')

        this.call("lan/browser/pub/",{},'GET',function(rc){
            var online=[];
            rc.result.forEach(function(pc){
                if(pc.reachable && pc.host_type=='freebox_player'){
                    console.log(pc);
                    online.push(pc);
                }
            })
            if(typeof cb=='function') cb(online)
            console.log('retour interfaces')
//             console.log(rc)
        })
    }
    this.isTVon = function(cb){
        
        console.log('airMedia')

        this.call("airmedia/receivers/Freebox%20Player/",{ "action": "stop", "media_type": "video" },'POST',function(rc){
         
            console.log('retour airMedia')
            console.log(rc)
             if(typeof cb == 'function') cb(rc.success)
        })
        
    }
    
    this.telecommande = function(key,long,t){
        if(t==undefined) t=0;
            var str = key.toString();
        console.log((parseInt(key) && key>9?' integer':'string')+ '- telecommande '+key+' long= '+long+' str.length='+str.length)
        if(parseInt(key) && key>9){
            var ts=0;
            for(var i=0; i<str.length;i++) {
                
//                setTimeout(function(){
                    
                this.telecommande(str[i],false,ts);
//                }.bind(this),ts)
                ts+=500;
            }
//            key.forEach(function(akey,i){
////                if(i==0){
//                    this.telecommande(akey,i==0)
////                }
//            }.bind(this))
            return;
        }
        setTimeout(function(){
            
        var req = http.request({
            host: 'hd1.freebox.fr',
            port: 80,
            path: "/pub/remote_control?code=6606980&key="+key+(long?'&long=true':''),
            method: "GET",
          }, function(res) {
            console.log('sent')
            
        })
        req.end();
        },t)
    }
    this.volPlus = function(long){
        console.log('#############vol_inc TV')
        this.isTVon(function(isOn){
            if(isOn){
                this.telecommande('vol_inc',long);                  
            }
        }.bind(this))
    }
    this.volMoins = function(long){
        console.log('#############vol_dec  TV')
        this.isTVon(function(isOn){
            if(isOn){
                this.telecommande('vol_dec',long);                  
            }
        }.bind(this))
    }
    this.mute = function(){
        console.log('#############mute  TV')
        this.isTVon(function(isOn){
            if(isOn){
                this.telecommande('mute');                  
            }
        }.bind(this))
    }
    this.stopTV = function(){
        console.log('#############stopTV TV')
        this.isTVon(function(isOn){
            if(isOn){
                this.telecommande('power');                  
            }
        }.bind(this))
        
    }
    this.goToChaine = function(chaine){
        this.telecommande(chaine);        
    }
    this.startTV = function(chaine){
        console.log('#############START TV')
        this.isTVon(function(isOn){
            var ts=0;
            if(!isOn){
                this.telecommande('power');                
                ts = 3000;
                setTimeout(function(){
                    this.telecommande('home');
                     setTimeout(function(){
                        this.telecommande('ok');
                    }.bind(this),800);
                }.bind(this), ts);
            }
            setTimeout(function(){
                this.telecommande(chaine);
            }.bind(this), parseInt(ts*3));
        }.bind(this))
        //http://hd1.freebox.fr/pub/remote_control?code=6606980&key=power
        //http://hd1.freebox.fr/pub/remote_control?code=6606980&key=home
        //http://hd1.freebox.fr/pub/remote_control?code=6606980&key=ok  
    }
    return this;
    
    
}
module.exports = freebox;

//var free = new freebox();
//
//free.init('idNodeJs',false,function(){
//    
//    free.authorize('nodeJS',function(ok){
//        if(ok){
//            console.log('cb authorize '+free.token)
//            
//            free.login(function(){                
//                free.stopTV();
//                 setTimeout(function(){
//                free.startTV(2);
//            }, 2000);
//            });
//        }   
//        else{
//            console.log('Veuillez autoriser  l\'accès dans votre freebox server')
//        }
//    });
//});

/*power : la touche rouge on/off 
list : la touche d’affichage de la liste des chaînes entre power et tv 
tv : la touche verte TV de commutation péritel. 
 
0 à 9 : les touches 0 à 9 
 
back : la touche jaune en dessous du 7 
swap : la touche en dessous du 9 
 
info, mail, help, pip : les touches bleues à droite des numéros de chaîne 
epg, media, options : les fonctionnalités "secondaires" de ces mêmes touches 
 
vol_inc, vol_dec : volume+ et volume- 
prgm_inc, prgm_dec : program+ et program- 
ok : touche OK 
up, right, down, left : les touches directionnelles entourant le OK 
 
mute : la touche de mise en sourdine 
home : la touche free 
rec : la touche d’enregistrement 
bwd : la touche de retour en arrière (<<) 
prev : la touche "précédent" (|<<) 
play : la touche lecture/pause 
fwd : la touche d’avance rapide (>>) 
next : la touche "suivant" (>>|) 
 
Concernant les boutons de couleurs, de haut en bas, et de gauche à droite (par rapport à la télécommande physique) les valeurs disponibles pour : 
 
red : le bouton rouge (B) 
green : le bouton vert (A) 
yellow : le bouton jaune (Y) 
blue : le bouton bleu (X) 
 */
