const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const Axios = require("axios");
require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.listen(3010, () => {
  console.log("App running on port 3010");
});

app.get("/", (req, res) => {
  res.send({ Status: "OK", CODE: 200 });
});

app.get("/pdl/update_pdl_person_info", async (req, res) => {
  if (req.header("X-Api-Key") != process.env.LTAPIKey) {
    res.send({ Status: "Invalid API Key", Code: 401 });
  }
  let f_name = req.query.first_name;
  let l_name = req.query.last_name;
  let email = req.query.email;
  let id = req.query.id;
  let phone = req.query.phone;
  let state = req.query.state;
  let mail_address = req.query.mail_address;
  let current_company = req.query.current_company;
  if (!current_company) {
    current_company = "Unknown";
  }
  let current_title = req.query.current_title;
  if (!current_title) {
    current_title = "Unknown";
  }
  let personalAddr = "";
  let companyAddr = "";
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

  let currentJob = {
    company: {
      name: current_company,
    },
    end_date: "0000-00",
    start_date: "0000-00",
    title: {
      name: current_title,
    },
  };

  Axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.pdlAPIKey,
    },
  })
    .then((response) => {
      const experience = response.data.data.experience;
      const data = response.data.data;
      const likelihood = response.data.likelihood;
      const STATUS = response.data.status;
      if (STATUS == 200) {
        if (!f_name && data.first_name) {
          f_name = data.first_name;
        }
        if (!l_name && data.last_name) {
          l_name = data.last_name;
        }
        if (!phone && data.phone_numbers.length > 0) {
          phone = data.phone_numbers[0];
        } else if (!phone) {
          phone = "Unknown";
        }
        if (!state && data.street_addresses.length > 0) {
          state = data.street_addresses[0].name;
        } else if (!state) {
          state = "Unknown";
        }
        if (!mail_address && data.street_addresses.length > 0) {
          personalAddr =
            data.street_addresses[0].street_address +
            ", " +
            data.street_addresses[0].name +
            " " +
            data.street_addresses[0].postal_code;
        } else if (!mail_address) {
          mail_address = "Unknown";
        }

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
          } else if (
            typeof jobs[i].end_date === "string" &&
            typeof currentJob.end_date !== "string" &&
            typeof currentJob.start_date == "string"
          ) {
            //current job is still the current job
          } else {
            currentJob.company.name += " || " + jobs[i].company.name;
            currentJob.start_date += " || " + jobs[i].start_date;
            currentJob.end_date += " || " + jobs[i].end_date;
            currentJob.title.name += " || " + jobs[i].title.name;
          }
        }
        if (currentJob.company.location.name) {
          companyAddr =
            currentJob.company.location.street_address +
            ", " +
            currentJob.company.location.name +
            " " +
            currentJob.company.location.postal_code;
        }

        properties = {
          company: currentJob.company.name,
          jobtitle: currentJob.title.name,
          firstname: f_name,
          lastname: l_name,
          phone: phone,
          state: state,
          address: "Job: " + companyAddr + " Personal: " + personalAddr,
        };
        // console.log(currentJob);
        // console.log(properties);
        Axios.patch(
          "https://api.hubspot.com/crm/v3/objects/contacts/" + id,
          {
            properties: {
              company: currentJob.company.name,
              jobtitle: currentJob.title.name,
              lastname: l_name,
              phone: phone,
              state: state,
              likelihood: likelihood,
              address: "Job: " + companyAddr + " Personal: " + personalAddr,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.hubspotAPIKey}`,
            },
          }
        )
          .then((response) => {
            res.sendStatus(200);
          })
          .catch((error) => {
            console.log(error);
            res.sendStatus(error.response.status);
          });
      } else {
        console.log(STATUS + " ERROR");
        res.sendStatus(400);
      }
    })
    .catch((error) => {
      console.log("Contact Not Found");
      if (!email) {
        email == "Unknown";
      }
      if (!phone) {
        phone == "Unknown";
      }
      if (!state) {
        state == "Unknown";
      }
      if (!mail_address) {
        mail_address == "Unknown";
      }
      if (!personalAddr) {
        personalAddr == "Unknown";
      }
      if (!companyAddr) {
        companyAddr == "Unknown";
      }
      Axios.patch(
        "https://api.hubspot.com/crm/v3/objects/contacts/" + id,
        {
          properties: {
            company: current_company,
            jobtitle: current_title,
            lastname: l_name,
            phone: phone,
            state: state,
            likelihood: 0,
            address: "Job: " + companyAddr + " Personal: " + personalAddr,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.hubspotAPIKey}`,
          },
        }
      )
        .then((response) => {
          res.sendStatus(200);
        })
        .catch((error) => {
          console.log(error);
          res.sendStatus(error.response);
        });
    });
});

app.get("/pdl/update-pdl-company-info", (req, res) => {
  res.send({ Status: "OK", Code: 200 });
});
