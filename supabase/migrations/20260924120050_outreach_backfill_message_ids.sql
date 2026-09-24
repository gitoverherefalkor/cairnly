-- Backfill the RFC Message-ID of the latest mail Sjoerd sent by hand to each
-- agency still in play, so the first automated chase can carry In-Reply-To /
-- References and land in the same conversation on the agency's side.
--
-- Read from Gmail (raw message headers) on 2026-09-24. Only fills empty
-- values; safe to re-run.

update public.outreach_mails m
   set rfc_message_id = v.rfc
  from (values
    ('1a0afe38a64829d9', '<CAMqP_2WvH_3Kkx=iC7+kjNcyLB35mSuqLrXQ_V=fHAKJKnwQLA@mail.gmail.com>'),
    ('1a0b3be7ae6cb4d1', '<CAMqP_2XvZi1QG_87sXWZYjU04cCnMxz3Cx1D+Zzeoyt9BBZeeQ@mail.gmail.com>'),
    ('1a0b319af9b13539', '<CAMqP_2X3afxLf6x2ch0C6OpCLBUYnHfwnQKx-F-7t9GUbL50YQ@mail.gmail.com>'),
    ('1a0cd29211a77088', '<CAMqP_2XBYa49obKB7q38mMA6bcxM9pcnV4Z6W3_43JcRosQZ9A@mail.gmail.com>'),
    ('1a0ccd97af8277cc', '<CAMqP_2UsfxuEMusaVD1n4MXfYJwfQorf-qTLGb61qcOu0+-gGw@mail.gmail.com>'),
    ('1a0a4330b14c6eed', '<CAMqP_2XJOCSa2qF2aU8bEs_Wt056Vio3ecby_dXe+CZXjZWWgA@mail.gmail.com>'),
    ('1a0a46d46f8d7f09', '<CAMqP_2XOR-0fu_LnS0T38LrybSWn2104bbhj07SAaCd1g_LEaw@mail.gmail.com>'),
    ('1a0a5103c5fd8b8e', '<CAMqP_2X=Kj-H1KnZBVbbEk_0yEFP2pSJnM+oZZ3YPmNp-Rj34g@mail.gmail.com>'),
    ('1a0a4bfbfa4cf91b', '<CAMqP_2VZeqCHyAZs9Mj7n0zRPe3O3qxir-yMTWNbp9z1xLBE=g@mail.gmail.com>'),
    ('1a0a4ec89ab5c677', '<CAMqP_2Wpq75SndTcxgKx89xeYdB=YY-c_3OxGobmvoNwnOpX9A@mail.gmail.com>'),
    ('1a0cd725e1709415', '<CAMqP_2VED4hR7j-rb01OGUKhS+Pe8ADi5MV4m25TkPPm0qB+eg@mail.gmail.com>'),
    ('1a0cd1990bc67762', '<CAMqP_2XY-oB19KjDGMwE_sPCduMLZhmSdiaLnwnze5kCXGiRcA@mail.gmail.com>'),
    ('1a0cdb7f471a69e1', '<CAMqP_2VX6U3pVdkbFeZH62o7-Gq3G8NrqEb3eC8cmkC8OopMoQ@mail.gmail.com>'),
    ('1a0a435735728a15', '<CAMqP_2VPjOuSkWGDxqw4aMSonS-w4tRxo7BGp=a0+60kpbkq9Q@mail.gmail.com>'),
    ('1a0cde78fe7ec1ba', '<CAMqP_2W8aSPg=vn+t8OAHZRvQuKyKbe30uuDbrddt17HtjjSbw@mail.gmail.com>'),
    ('1a0a433ffdf0f6fd', '<CAMqP_2VPejK1Cu2LQKPvoXVLXZ7GJm60VdFowGDogs0d9YQQkQ@mail.gmail.com>'),
    ('1a0cd8cec6ebcf43', '<CAMqP_2Wi8W4hV_iu9j1ipdY3TJqteAGHy6_6nyVu1t+42M42yg@mail.gmail.com>'),
    ('1a0e69946c8c678d', '<CAMqP_2XQ-fe8NP1jm1M2FbJzjxP4ZKqd7+pqtEWAXOeGgPOqzg@mail.gmail.com>'),
    ('1a08f5c36d2a7589', '<CAMqP_2XWJrHGFvyj02iqngRTwpEzioaWEoyQNPL6cj2Wke6PAA@mail.gmail.com>'),
    ('1a0a471da50cd6fe', '<CAMqP_2VNQm0i-NDqd9y_YdkihXftkMJ0+mK9vsfnxKe2ZV2Fpg@mail.gmail.com>'),
    ('1a0cd22b9946c79c', '<CAMqP_2XouYTv-yoJfjaQC87TMxUj+8AKtZRjVSywWtLSu=RboQ@mail.gmail.com>'),
    ('1a0afa896aca21f7', '<CAMqP_2Xqbrw6gAEHi+4M+ChtLhezz=nynu+DPVA38ecm9VQ6zg@mail.gmail.com>'),
    ('1a0afa8b699fbcf1', '<CAMqP_2Wsxh9dxEG47c2k335CujX8F4VXMAMYoEbW4f0kRTK5Qw@mail.gmail.com>'),
    ('1a0cd4dc05c01793', '<CAMqP_2WWbfvHcZ_zHJpL+bk_kf-3LgjPXKzRNQ9aVQQ0bBmDQA@mail.gmail.com>'),
    ('1a0cd3509ed48b70', '<CAMqP_2Wht7fEbGRCiGO6GwCh5A8PRs0DYnEt--WgGck3_0c6Fg@mail.gmail.com>'),
    ('1a090e07183a563c', '<CAMqP_2XrNacUR7PU-GsXoGAvSFnJrJ8AjXMNrsDotzeow86tCA@mail.gmail.com>'),
    ('1a0ca3d394560016', '<CAMqP_2WaTtMZc-p5VCO_hRj0OzQawqDL16htD2=5i8DpjJk3UA@mail.gmail.com>'),
    ('1a0cd1e25e9a8cd3', '<CAMqP_2Wmpj-njiGjNk-R12cVe5o0ZiHWn66MO7boTH7gpi-auQ@mail.gmail.com>'),
    ('1a0b352722896b41', '<CAMqP_2X673v4VrMpikhNAGEfW67HdhGrsWeGWs+wrwdsWHL-=w@mail.gmail.com>'),
    ('1a0ca3d5131a97f5', '<CAMqP_2XorXerLZc=rXaNRDz-rBVqnzPfUZN7FCrgnO=RDyefKA@mail.gmail.com>'),
    ('1a0c28cc213f5df3', '<CAMqP_2X_RdEbWk01qpvNYYhEtV3DXy3XRMsCPJzDCBLRRKf25g@mail.gmail.com>'),
    ('1a0cd909763e0af7', '<CAMqP_2V+xEmT-JYYq3bdcEgRyG2T51PJW_D=jjGGJSy7=5YnTQ@mail.gmail.com>'),
    ('1a0a4a1756bb5911', '<CAMqP_2XbdXBaY2wkcnohDerSECMZJjDDKgPbkTeS-5mkQX0BKg@mail.gmail.com>'),
    ('1a0cd492c9bb63c7', '<CAMqP_2U+69n2GdQUEGjg3Ph89TRYZs7H1mBcDhpDbL1T6wzcDg@mail.gmail.com>'),
    ('1a0c28cc2c7dc746', '<CAMqP_2WrCKOOady0sre_CfuEXWQ2oAxigpwRLAKeep4CSLJSkw@mail.gmail.com>')
  ) as v(gmail_id, rfc)
 where m.gmail_message_id = v.gmail_id
   and m.rfc_message_id is null;
