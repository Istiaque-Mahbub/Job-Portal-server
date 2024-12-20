const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors({
  origin : ['http://localhost:5173',
    'https://job-portal-4c64f.web.app',
    'https://job-portal-4c64f.firebaseapp.com'
  ],
  credentials:true,
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req,res,next) =>{
  console.log("inside the logger");
  next();
}


const verifyToken = (req,res,next) =>{
  // console.log('inside verify token', req.cookies)
  const token = req?.cookies?.token
  
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message: 'Unauthorized access'})
    }
    req.user = decoded;
    next();
  })
  
}


//mongodb+srv://<db_username>:<db_password>@cluster0.vmt4q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vmt4q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // jobs related apis
    const jobCollection = client.db('jobPortal').collection('jobs');
    const jobApplicationCollection = client.db('jobPortal').collection('job_applications')


    // Auth related APIs
    app.post('/jwt', async (req, res) => {
      try {
          const user = req.body
          console.log(user)
          const token = jwt.sign(user, process.env.JWT_SECRET, {
              expiresIn: '1d',
          })
          res
              .cookie('token', token, {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === "production",
                  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
              })
              .send({
                  status: true,
              })
      } catch (error) {
          res.send({
              status: true,
              error: error.message,
          })
      }
  })
  


    app.post('/logout',(req,res)=>{
      res.clearCookie('token',{
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({success: true})
    })

    app.get('/jobs', async (req, res) => {
      const email = req.query.email;
      let query = {}
      if (email) {
        query = { hr_email: email }
      }
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobCollection.findOne(query);
      res.send(result);
    })

    app.post('/jobs', async (req, res) => {
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result)
    })

    //job application related APIs
    app.get('/job-application',verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      
      // console.log('cookies',req.cookies)

      if(req.user.email !== req.query.email){
        return res.status(403).send({message:'forbidden access'})
      }
      
      const result = await jobApplicationCollection.find(query).toArray();
      //not best way for aggregate
      for (const application of result) {
        const filter = { _id: new ObjectId(application.job_id) }
        const job = await jobCollection.findOne(filter)
        if (job) {
          application.title = job.title
          application.company = job.company
          application.company_logo = job.company_logo
          application.location = job.location
        }
      }
      res.send(result);
    })


    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result)
    })


    app.post('/job-applications', async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);
      //Not the best way (use Aggregate)
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobCollection.findOne(query)
      let count = 0;
      if (job.applicationCount) {
        count = job.applicationCount + 1;
      } else {
        count = 1
      }

      //now update the job info
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: count
        },
      }
      const updateResult = await jobCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/job-applications/:id',async(req,res)=>{
       const id  = req.params.id;
       const data = req.body
       const filter = {_id: new ObjectId(id)};
       const updatedDoc = {
        $set:{
           status: data.status,
        }
       }
       const result = await jobApplicationCollection.updateOne(filter,updatedDoc)
       res.send(result);
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Job is falling from the sky');
})

app.listen(port, () => {
  console.log('Job is waiting at ', port)
})