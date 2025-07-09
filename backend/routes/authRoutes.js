import express from 'express';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import FormData from 'form-data';

const router = express.Router();
const upload = multer({
  dest: '/uploads',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
  },
});

const authenticateToken = (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  req.user = { access_token: token, id: process.env.USER_ID };
  next();
};

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { access_token } = req.user;
    const { data } = await axios.get(
      `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${access_token}`
    );
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch profile:', err.message);
    res.status(500).json({ message: 'Could not retrieve Instagram profile' });
  }
});

router.post('/instagram', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'Authorization code missing' });

  try {
    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      null,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: {
          client_id: process.env.INSTAGRAM_CLIENT_ID,
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: process.env.REDIRECT_URI,
          code,
        },
      }
    );

    const { access_token, user_id } = tokenResponse.data;
    const userInfoResponse = await axios.get(
      `https://graph.instagram.com/${user_id}?fields=id,username&access_token=${access_token}`
    );

    const user = {
      id: userInfoResponse.data.id,
      username: userInfoResponse.data.username,
    };

    res.json({ access_token, user });
  } catch (err) {
    console.error('OAuth Error:', err?.response?.data || err.message);
    res.status(500).json({ message: 'Instagram login failed' });
  }
});

router.post('/post', authenticateToken, upload.single('image'), async (req, res) => {
  const caption = req.body.caption || '';
  const image = req.file;
  const accessToken = req.user.access_token;
  const userId = req.user.id;

  try {
    let creationId;

    if (image) {
      const imageBuffer = fs.readFileSync(image.path);
      const form = new FormData();
      form.append('image', imageBuffer, {
        filename: image.originalname,
        contentType: image.mimetype,
      });
      form.append('media_type', 'IMAGE');
      form.append('caption', caption);
      form.append('access_token', accessToken);

      const uploadResponse = await axios.post(
        `https://graph.threads.net/v1.0/${userId}/media`,
        form,
        { headers: form.getHeaders() }
      );

      creationId = uploadResponse.data.id;
    } else {
      const createRes = await axios.post(
        `https://graph.threads.net/v1.0/${userId}/threads`,
        null,
        {
          params: {
            media_type: 'TEXT',
            text: caption,
            access_token: accessToken,
          },
        }
      );
      creationId = createRes.data.id;
    }

    const publishRes = await axios.post(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: accessToken,
        },
      }
    );

    res.status(200).json({
      message: 'Thread posted successfully!',
      thread_id: publishRes.data.id,
    });
  } catch (err) {
    console.error('Threads post error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to post to Threads' });
  } finally {
    if (image && fs.existsSync(image.path)) {
      fs.unlink(image.path, (err) => {
        if (err) console.error('Failed to delete file:', err);
      });
    }
  }
});

router.get('/refresh-token', async (req, res) => {
  try {
    const { data } = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: {
        grant_type: 'ig_refresh_token',
        access_token: req.headers['x-access-token'],
      },
    });
    res.json({ access_token: data.access_token });
  } catch (err) {
    res.status(500).json({ message: 'Failed to refresh token' });
  }
});

export default router;