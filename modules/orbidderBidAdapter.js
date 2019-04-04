import {detectReferer} from '../src/refererDetection';
import {ajax} from '../src/ajax';
import {registerBidder} from '../src/adapters/bidderFactory';

export const spec = {
  code: 'orbidder',
  bidParams: {},
  versionPath: (() => {
    let ret = '';
    try {
      ret = localStorage.getItem('ov_orbidder_version') || ret;
    } catch (e) {
    }
    return ret;
  })(),
  orbidderHost: (() => {
    let ret = 'https://orbidder.otto.de';
    try {
      ret = localStorage.getItem('ov_orbidder_host') || ret;
    } catch (e) {
    }
    return ret;
  })(),

  isBidRequestValid(bid) {
    return !!(bid.sizes && bid.bidId && bid.params &&
      (bid.params.accountId && (typeof bid.params.accountId === 'string')) &&
      (bid.params.placementId && (typeof bid.params.placementId === 'string')) &&
      ((typeof bid.params.bidfloor === 'undefined') || (typeof bid.params.bidfloor === 'number')) &&
      ((typeof bid.params.keyValues === 'undefined') || (typeof bid.params.keyValues === 'object')));
  },

  buildRequests(validBidRequests, bidderRequest) {
    if (spec.versionPath === "") {
      //first version with single request per ad-slot
      return validBidRequests.map((bidRequest) => {
        let referer = '';
        if (bidderRequest && bidderRequest.refererInfo) {
          referer = bidderRequest.refererInfo.referer || '';
        }
        const ret = {
          url: `${spec.orbidderHost}/bid`,
          method: 'POST',
          data: {
            pageUrl: referer,
            bidId: bidRequest.bidId,
            auctionId: bidRequest.auctionId,
            transactionId: bidRequest.transactionId,
            adUnitCode: bidRequest.adUnitCode,
            sizes: bidRequest.sizes,
            params: bidRequest.params
          }
        };
        spec.bidParams[bidRequest.bidId] = bidRequest.params;
        if (bidRequest && bidRequest.gdprConsent) {
          ret.data.gdprConsent = {
            consentString: bidRequest.gdprConsent.consentString,
            consentRequired: (typeof bidRequest.gdprConsent.gdprApplies === 'boolean')
              ? bidRequest.gdprConsent.gdprApplies
              : true
          };
        }
        return ret;
      });
    } else {
      //newer Version, use multi bid request
      const bids = [];
      for (const bidRequest of validBidRequests) {
        const item = {
          bidId: bidRequest.bidId,
          auctionId: bidRequest.auctionId,
          transactionId: bidRequest.transactionId,
          adUnitCode: bidRequest.adUnitCode,
          sizes: bidRequest.sizes,
          params: bidRequest.params
        };
        spec.bidParams[bidRequest.bidId] = bidRequest.params;
        if (bidRequest && bidRequest.gdprConsent) {
          item.data.gdprConsent = {
            consentString: bidRequest.gdprConsent.consentString,
            consentRequired: (typeof bidRequest.gdprConsent.gdprApplies === 'boolean')
              ? bidRequest.gdprConsent.gdprApplies
              : true
          };
        }
        bids.push(item);
      }

      let referer = '';
      if (bidderRequest && bidderRequest.refererInfo) {
        referer = bidderRequest.refererInfo.referer || '';
      }

      return {
        url: `${spec.orbidderHost}/${spec.versionPath}/bid`,
        method: 'POST',
        data: {
          pageUrl: referer,
          bids: bids
        }
      };
    }
  },

  interpretResponse(serverResponse) {
    const bidResponses = [];
    serverResponse = serverResponse.body;
    if (serverResponse && (serverResponse.length > 0)) {
      serverResponse.forEach((bid) => {
        const bidResponse = {};
        for (const requiredKey of ['requestId', 'cpm', 'width', 'height', 'ad', 'ttl', 'creativeId', 'netRevenue', 'currency']) {
          if (!bid.hasOwnProperty(requiredKey)) {
            return [];
          }
          bidResponse[requiredKey] = bid[requiredKey];
        }
        bidResponses.push(bidResponse);
      });
    }
    return bidResponses;
  },

  onBidWon(winObj) {
    const getRefererInfo = detectReferer(window);

    winObj.pageUrl = getRefererInfo().referer;
    if (spec.bidParams[winObj.adId]) {
      winObj.params = spec.bidParams[winObj.adId];
    }

    spec.ajaxCall(`${spec.orbidderHost}/win`, JSON.stringify(winObj));
  },

  ajaxCall(endpoint, data) {
    ajax(endpoint, null, data);
  }
};

registerBidder(spec);
