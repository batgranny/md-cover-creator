package musicbrainz

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const (
	BaseURL = "https://musicbrainz.org/ws/2"
	// UserAgent is required by MusicBrainz API
	UserAgent = "MiniDiscCoverCreator/1.0.0 ( contact@example.com )"
)

type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type SearchResponse struct {
	Created  string    `json:"created"`
	Count    int       `json:"count"`
	Offset   int       `json:"offset"`
	Releases []Release `json:"releases"`
}

type Release struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Date         string `json:"date"`
	Score        int    `json:"score"`
	ArtistCredit []struct {
		Name string `json:"name"`
	} `json:"artist-credit"`
}

func (c *Client) SearchReleases(query string) (*SearchResponse, error) {
	// Construct URL
	u, err := url.Parse(BaseURL + "/release/")
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("query", query)
	q.Set("fmt", "json")
	u.RawQuery = q.Encode()

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("musicbrainz api error: %s", resp.Status)
	}

	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

type ReleaseDetail struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Media        []Medium `json:"media"`
	ArtistCredit []struct {
		Name string `json:"name"`
	} `json:"artist-credit"`
}

type Medium struct {
	Position int     `json:"position"`
	Format   string  `json:"format"`
	Tracks   []Track `json:"tracks"`
}

type Track struct {
	ID       string `json:"id"`
	Position int    `json:"position"`
	Title    string `json:"title"`
	Length   int    `json:"length"`
}

func (c *Client) GetRelease(id string) (*ReleaseDetail, error) {
	u, err := url.Parse(BaseURL + "/release/" + id)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("inc", "recordings") // Include recordings to get tracks
	q.Set("fmt", "json")
	u.RawQuery = q.Encode()

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("musicbrainz api error: %s", resp.Status)
	}

	var result ReleaseDetail
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
