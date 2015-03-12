var _ = require('lodash');
var FB = require('fb');
var fs = require('fs');
var urllib = require('url');

var config = {

  accessToken: "",
  maxPhotos: 30,
  maxPhotosPerQuery: 25,
  color: "Red",
  outputFile: "/tmp/network.net"

};
require("./config")(config);


var builder = function(){

  FB.setAccessToken(config.accessToken);

  this.photoCount = 0;

  /**
  {
    name: String,
    links: {
      p1: 2,
      p2: 3
    }
  }
  */
  this.map = [];

}

builder.prototype.processPhoto = function(photo){

  if(this.photoCount>config.maxPhotos)
    return;
  this.photoCount += 1;

  var $this = this;

  var tags = _.map(photo.tags.data, "name");

  _.forEach(tags, function(tag){
    if(! _.find($this.map, {name: tag}) ){
      $this.map.push({
        name: tag,
        links: {}
      });
    }
  });

  _.forEach($this.map, function(p){
    if( _.includes(tags, p.name) ){
      _.forEach(tags, function(tag){
        if(p.name==tag)
          return;
        if(p.links[tag])
        {
          p.links[tag] += 1;
        } else {
          var obj = _.find($this.map, { name:tag });
          if( obj && obj.links[p.name] )
          {
            obj.links[p.name] += 1;
          } else {
            p.links[tag] = 1;
          }
        }
      });
    }
  });

}

builder.prototype.addPhoto = function(photoUrl){
  var query_parts = urllib.parse(photoUrl, true);

  var url = "/"+query_parts.query.fbid;
  var params = {
    fields: [ 'tags.limit(100){name}', 'images' ]
  };

  var $this = this;
  FB.api(url, params, function(res){
    if(!res || res.error) {
      console.log("error");
      console.log(!res ? 'error occurred' : res.error);
      return;
    }

    $this.processPhoto(res);

  });
}

builder.prototype.startPhotoLoop = function(endCallback){

  var url = 'me/photos';
  var params = {
    fields: [ 'tags.limit(100){name}', 'images' ],
    limit: config.maxPhotosPerQuery,
  };

  this.getPhotosNext(url, params, endCallback);

}

builder.prototype.getPhotosNext = function(url, params, endCallback){

  var $this = this;

  FB.api(url, params, function(res){
    if(!res || res.error) {
      console.log("error");
      console.log(!res ? 'error occurred' : res.error);
      return;
    }

    _.forEach(res.data, function(ph){
      $this.processPhoto(ph);
    });

    if($this.photoCount<config.maxPhotos && res.paging.next!=undefined && res.paging.next!=""){
      var query_parts = urllib.parse(res.paging.next, true);
      var params = {
        fields: [ 'tags.limit(100){name}', 'images' ],
        limit: config.maxPhotosPerQuery,
        after: query_parts.query.after,
        access_token: config.accessToken
      };
      $this.getPhotosNext("me/photos", params, endCallback);
    } else {
      $this.finish();
      endCallback();
    }

  });

}

builder.prototype.finish = function(){
  console.log("stopping...");
  this.printStats();
  this.writeFile();
}

builder.prototype.printStats = function(){
  console.log("Edges count: "+this.map.length);

  var $this = this;

  var linksCount = 0;
  _.forEach( this.map, function(p, index){
    linksCount += _.keys(p.links).length;
  });
  console.log("Links count: "+linksCount);

  var maxCon = 0;
  var p1, p2;
  function _print(){
    console.log("Strongest link: "+p1+" <-> "+p2+" ("+maxCon+")");
  }
  _.forEach(this.map, function(p, pindex){
    _.forEach( _.keys(p.links) , function(link, lindex){
      if(p.links[link]>maxCon){
        maxCon = p.links[link];
        p1 = p.name;
        p2 = link;
      }
      if(lindex== _.keys(p.links).length-1 && pindex==$this.map.length-1) {
        _print();
      }
    });
  });

}

builder.prototype.writeFile = function(){

  var $this = this;

  fs.open(config.outputFile, 'w', function(err, fd){

    fs.writeSync(fd, "*Vertices "+$this.map.length+"\n");

    _.forEach( $this.map, function(item, index){

      fs.writeSync(fd, (index+1)+" \""+item.name+"\" box ic "+config.color+"\n");

    });

    fs.writeSync(fd, "*Edges\n");

    _.forEach($this.map, function(item, index){

      _.forEach( _.keys(item.links) , function(link){
        var pos = _.findIndex($this.map, { name: link }) + 1;
        var line = (index+1)+" "+pos+" "+item.links[link]+"\n";
        fs.writeSync(fd, line);
      });

    });

    fs.closeSync(fd);

  });

}

var b = new builder();

b.addPhoto("https://www.facebook.com/photo.php?fbid=552854484734777&set=t.100001805095914&type=3&theater");
b.addPhoto("https://www.facebook.com/photo.php?fbid=110681832359926&set=t.100001805095914&type=3&theater");

b.startPhotoLoop(function(){
  console.log("Done.");
});
