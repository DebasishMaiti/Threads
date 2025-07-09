import React, { useEffect, useState } from 'react';
import { Button, Card, Alert, Layout, Typography, message, Input, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [error, setError] = useState('');
  const [postText, setPostText] = useState('');
  const [imageFile, setImageFile] = useState(null);

  const clientId = '739434025131880'
  const redirectUri = 'https://threads-l013vddyp-debasish-maitis-projects.vercel.app/'

  const handleLogin = () => {
    const url = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user_profile,threads_basic,threads_content_publish&response_type=code`;
    window.location.href = url;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      axios
        .post('http://localhost:5000/api/auth/instagram', { code })
        .then((res) => {
          const { access_token, user } = res.data;
          localStorage.setItem('access_token', access_token);
          setToken(access_token);
          setUser(user);
          setError('');
          message.success(`Welcome, ${user.username}`);
          window.history.replaceState({}, document.title, '/');
        })
        .catch(() => {
          setError('Login failed. Please try again.');
        });
    } else if (token && !user) {
      axios
        .get('http://localhost:5000/api/auth/profile', {
          headers: { 'X-Access-Token': token },
        })
        .then((res) => {
          setUser({ id: res.data.id, username: res.data.username });
        })
        .catch(() => {
          localStorage.removeItem('access_token');
          setToken('');
          message.error('Session expired. Please log in again.');
        });
    }
  }, [token]);

  const handlePost = () => {
    const formData = new FormData();
    formData.append('caption', postText);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    axios
      .post('http://localhost:5000/api/auth/post', formData, {
        headers: {
          'X-Access-Token': token,
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((res) => {
        message.success(res.data.message);
        setPostText('');
        setImageFile(null);
      })
      .catch((err) => {
        message.error(err.response?.data?.message || 'Failed to post');
      });
  };

  const fetchProfile = () => {
    axios
      .get('http://localhost:5000/api/auth/profile', {
        headers: { 'X-Access-Token': token },
      })
      .then((res) => {
        setProfile(res.data);
        setUser({ id: res.data.id, username: res.data.username });
        message.success('Profile fetched successfully');
      })
      .catch(() => {
        message.error('Failed to fetch profile.');
      });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: '#fff', fontSize: '20px' }}>Threads Scheduler</Header>
      <Content style={{ padding: '50px', maxWidth: 600, margin: '0 auto' }}>
        <Card>
          <Title level={4}>Threads Scheduler</Title>

          {error && <Alert message={error} type="error" className="mb-3" />}

          {!token ? (
            <Button type="primary" onClick={handleLogin}>
              Login with Threads
            </Button>
          ) : (
            <>
              <Alert
                message={`Logged in as ${user?.username}`}
                type="success"
                className="mb-3"
              />
              <Text>ID: {user?.id}</Text>
              <br />

              <Card style={{ marginTop: 24 }}>
                <Title level={5}>Create Thread</Title>
                <Input.TextArea
                  rows={3}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Write your thread post..."
                />
                <Upload
                  beforeUpload={(file) => {
                    setImageFile(file);
                    return false;
                  }}
                  showUploadList={{ showRemoveIcon: true, showPreviewIcon: false }}
                  fileList={imageFile ? [{ uid: '-1', name: imageFile.name, status: 'done' }] : []}
                >
                  <Button icon={<UploadOutlined />} style={{ marginTop: 10 }}>
                    {imageFile ? 'Change Image' : 'Upload Image (optional)'}
                  </Button>
                </Upload>
                <Button
                  type="primary"
                  onClick={handlePost}
                  style={{ marginTop: 10 }}
                  disabled={!postText}
                >
                  Post Thread
                </Button>
              </Card>

              <Button
                type="default"
                onClick={fetchProfile}
                style={{ marginTop: 16 }}
              >
                Get Profile
              </Button>

              {profile && (
                <Card style={{ marginTop: 24 }}>
                  <Title level={5}>My Instagram Profile</Title>
                  <p><strong>Username:</strong> {profile.username}</p>
                  <p><strong>Media Count:</strong> {profile.media_count}</p>
                  <p><strong>Account Type:</strong> {profile.account_type}</p>
                </Card>
              )}
            </>
          )}
        </Card>
      </Content>
    </Layout>
  );
}

export default App;