import * as http from "http";

interface RequestOptions extends http.RequestOptions {
  hostname?: string;
  port?: number;
  path?: string;
  method?: string;
  headers?: http.OutgoingHttpHeaders;
}

function request(options: RequestOptions, postData?: any): Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    req.on("error", (err) => reject(err));
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  const email = `test_user_${Math.random().toString(36).substring(2, 7)}@example.com`;
  const registerPayload = {
    email: email,
    password: "Password123!",
    fullName: "Integration Test Student"
  };

  console.log("1. Registering dummy user...");
  const regRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/register",
    method: "POST",
    headers: { "Content-Type": "application/json" }
  }, registerPayload);

  console.log(`Register status: ${regRes.statusCode}`);
  console.log(`Register body: ${regRes.data}`);

  let token = "";
  if (regRes.statusCode === 201 || regRes.statusCode === 400) {
    console.log("2. Logging in dummy user...");
    const loginRes = await request({
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { email: registerPayload.email, password: registerPayload.password });

    console.log(`Login status: ${loginRes.statusCode}`);
    console.log(`Login body: ${loginRes.data}`);
    try {
      const parsed = JSON.parse(loginRes.data);
      token = parsed.accessToken;
    } catch (e) {
      console.error("Login parsing failed:", e);
    }
  }

  if (!token) {
    console.error("Could not obtain auth token!");
    return;
  }

  console.log("3. Fetching /api/analytics with token...");
  const analyticsRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/analytics",
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(`Analytics status: ${analyticsRes.statusCode}`);
  console.log(`Analytics body:\n${analyticsRes.data}\n`);

  console.log("4. Fetching /api/quiz/leaderboard with token...");
  const leaderboardRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/quiz/leaderboard",
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(`Leaderboard status: ${leaderboardRes.statusCode}`);
  console.log(`Leaderboard body:\n${leaderboardRes.data}\n`);
}

run().catch((err) => {
  console.error("Test process failed:", err);
});
