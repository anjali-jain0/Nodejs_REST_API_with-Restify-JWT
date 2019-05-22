const restify = require('restify');
const mongoose = require('mongoose');
const config = require('./config');
const errors = require('restify-errors');
const timestamp = require('mongoose-timestamp');
const bcrypt=require('bcryptjs');
const jwt = require('jsonwebtoken');
const rjwt = require('restify-jwt-community');

const server = restify.createServer();

server.use(restify.plugins.bodyParser());

server.use(rjwt({secret:config.JWT_SECRET}).unless({path:['/auth']}));

server.listen(config.PORT ,() => {
	mongoose.connect('mongodb://localhost/api_restify_jwt');
});

var db = mongoose.connection;

db.on('error',(err) => console.log(err));

var CustomerSchema = new mongoose.Schema({
	name:{type:String,required:true,trim:true},
	email:{type:String,required:true,trim:true},
	balance:{type:Number,default:0}
});

var UserSchema = new mongoose.Schema({
	email:{type:String,required:true,trim:true},
	password:{type:String,required:true}
});

CustomerSchema.plugin(timestamp);

const Customer= mongoose.model('Customer',CustomerSchema,'Customer');
const User= mongoose.model('User',UserSchema,'User');

db.once('open' ,() =>{

	server.get('/customers',function(req,res,next){
		Customer.find({},function(err,data){
			if(err) {return next(new errors.InvalidContentError(err));}
			res.send(data);
			next();
		});
	});

server.post('/customers',function(req,res,next){
	if(!req.is('application/json')){
		return next(new errors.InvalidContentError("Expects 'application/json' "));
	}

	const {name , email , balance} = req.body;
	const customer = Customer({name,email,balance}).save(function(err){
		if(err) { return next(new errors.InvalidContentError(err.message)); };
		 res.send(201) ; 
		 next();
	});
});

server.get('/customer/:id',function(req,res,next){
	var query = {_id:req.params.id};
	Customer.find(query,function(err,data){
			if(err) {return next(new errors.ResourceNotFoundError(`There is no customer with id ${req.params.id}`));}
			res.send(data);
			next();
		});
});

server.put('/customer/:id',function(req,res,next){
	if(!req.is('application/json')){
		return next(new errors.InvalidContentError("Expects 'application/json' "));
	}
 	var query = {_id:req.params.id};
	Customer.update(query,req.body,function(err,data){
		if(err) { return next(new errors.ResourceNotFoundError(`There is no customer with id ${req.params.id}`));};
		 res.send(200) ; 
		 next();
	});
});

server.del('/customer/:id',function(req,res,next){
	var query = {_id:req.params.id};
	Customer.remove(query,function(err){
		if(err) { return next(new errors.ResourceNotFoundError(`There is no customer with id ${req.params.id}`));};
		res.send(204);
		next();
	});
});

server.post('/register',function(req,res,next){
	if(!req.is('application/json')){
		return next(new errors.InvalidContentError("Expects 'application/json' "));
	}

	const {email , password} = req.body;
	bcrypt.genSalt(10,function(err,salt){
		bcrypt.hash(password,salt,function(err,hash){
			if(err) throw err;
			pwd=hash;
			const user = User({email:email,password:pwd}).save(function(err){
			if(err) { return next(new errors.InvalidContentError(err.message)); };
				res.send(201) ; 
				next();
	        });
        });
    });
});

server.post('/auth',function(req,res,next){
    var {email ,password} = req.body;
	var query = {email:email} ;

	User.find(query,function(err,user){

		if(err) { return next(new errors.ResourceNotFoundError('Authentication Failed'));};

		bcrypt.compare(password,user[0].password ,function(err,isMatch){
			if(err) throw err;
			if(isMatch) {
				const token = jwt.sign(user[0].toJSON(), config.JWT_SECRET, {expiresIn : '15m'});
				const {iat , exp} = jwt.decode(token);
				res.send({iat , exp , token});
				next();
			} else {
				return next(new errors.ResourceNotFoundError('Authentication Failed'));;
			}
		});
	});
});

});