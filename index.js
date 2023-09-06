const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const Axios = require("axios");

app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.listen(3010, () => {
  console.log("App running on port 3010");
});

app.get("/update_pdl_info", async (req, res) => {
  let f_name = req.query.first_name;
  let l_name = req.query.last_name;
  let email = req.query.email;
  let id = req.query.id;
  let url =
    "https://api.peopledatalabs.com/v5/person/enrich?titlecase=true&min_likelihood=5";
  if (f_name) {
    url += "&first_name=" + f_name;
  }
  if (l_name) {
    url += "&last_name=" + l_name;
  }
  if (email) {
    url += "&email=" + email;
  }

  console.log(url);

  let currentJob = {
    company: {
      name: "Unknown",
    },
    end_date: "0000-00",
    start_date: "0000-00",
    title: {
      name: "Unknown",
    },
  };

  Axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key":
        "95defabca26cfbec8fd205f398fa9041928440e1fc3c34a452c4cb36b0444ead",
    },
  })
    .then((response) => {
      const experience = response.data.data.experience;
      const STATUS = response.data.status;
      if (STATUS == 200) {
        //loop through all jobs and decide which is most recent or currently ongoing
        var jobs = experience;
        for (var i = 0; i < jobs.length; i++) {
          if (
            typeof jobs[i].end_date !== "string" &&
            typeof currentJob.end_date === "string" &&
            typeof jobs[i].start_date === "string"
          ) {
            currentJob = jobs[i];
          } else if (
            typeof jobs[i].end_date == "string" &&
            typeof currentJob.end_date == "string"
          ) {
            if (
              parseInt(jobs[i].end_date.substring(0, 4)) >
              parseInt(currentJob.end_date.substring(0, 4))
            ) {
              currentJob = jobs[i];
            }
          } else if (typeof jobs[i].start_date === "string") {
            currentJob.company.name += " || " + jobs[i].company.name;
            currentJob.start_date += " || " + jobs[i].start_date;
            currentJob.end_date += " || " + jobs[i].end_date;
            currentJob.title.name += " || " + jobs[i].title.name;
          }
        }
        console.log(currentJob);
      } else {
        console.log(STATUS + " ERROR");
        res.sendStatus(400);
      }
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(error.response.status);
    });

  Axios.patch("https://api.hubspot.com/crm/v3/objects/contacts/" + id, {
    properties: {
      company: currentJob.company.name,
      jobtitle: currentJob.title.name,
      lastname: l_name,
    },
  })
    .then((response) => {
      res.sendStatus(200);
    })
    .catch((error) => {
      console.log(error);
      res.sendStatus(error.response.status);
    });

  //res.sendStatus(200);
});
